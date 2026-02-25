import { Job } from "bullmq";
import { PIPELINE_EVENTS } from "@smart-doc/shared";
import { prisma } from "../prisma.js";
import { embedMany } from "../services/ai.service.js";
import { parseFile, parseText } from "../services/parser.service.js";
import { chunkSections } from "../utils/chunker.js";
import { QueuePublishers } from "../workers.js";

interface DocumentUploadedEvent {
  workspaceId: string;
  documentId: string;
  versionId: string;
  ingestionJobId?: string;
  objectKey: string;
  fileName?: string;
  mimeType?: string;
  // 兼容历史队列消息：旧版本可能直接把 base64 放在事件体里。
  contentBase64?: string;
}

interface DocumentParsedEvent {
  workspaceId: string;
  documentId: string;
  versionId: string;
  sections: Array<{
    sectionId: string;
    headingPath: string[];
    content: string;
    page?: number;
    url?: string;
  }>;
}

interface DocumentEmbeddedEvent {
  workspaceId: string;
  documentId: string;
  chunkCount: number;
}

/**
 * 函数说明：createIngestionProcessor，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export function createIngestionProcessor(publishers: QueuePublishers) {
  return async (job: Job): Promise<void> => {
    // 入库流水线采用事件驱动分阶段执行：
    // uploaded -> parsed -> embedded -> indexed
    // 队列默认带重试，因此每个阶段都应保持幂等（重复执行不会破坏状态）。
    switch (job.name) {
      case PIPELINE_EVENTS.DOCUMENT_UPLOADED:
        await handleDocumentUploaded(job as Job<DocumentUploadedEvent>, publishers);
        return;
      case PIPELINE_EVENTS.DOCUMENT_PARSED:
        await handleDocumentParsed(job as Job<DocumentParsedEvent>, publishers);
        return;
      case PIPELINE_EVENTS.DOCUMENT_EMBEDDED:
        await handleDocumentEmbedded(job as Job<DocumentEmbeddedEvent>, publishers);
        return;
      case PIPELINE_EVENTS.DOCUMENT_INDEXED:
        return;
      default:
        throw new Error(`Unknown ingestion event: ${job.name}`);
    }
  };
}

/**
 * 函数说明：handleDocumentUploaded，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
async function handleDocumentUploaded(job: Job<DocumentUploadedEvent>, publishers: QueuePublishers): Promise<void> {
  const { workspaceId, documentId, versionId, ingestionJobId, fileName, mimeType, contentBase64 } = job.data;

  const ingestionJob = ingestionJobId
    ? await prisma.ingestionJob.findUnique({ where: { id: ingestionJobId } })
    : await prisma.ingestionJob.findFirst({
        where: { documentId, workspaceId },
        orderBy: { createdAt: "desc" },
      });

  if (!ingestionJob) {
    throw new Error("Ingestion job not found");
  }

  // payload 解析策略：
  // 1) 优先从 ingestion_job.payload 读取（新链路，避免大消息进队列）
  // 2) 兼容旧消息：若队列事件自带 fileName/contentBase64 则继续可用
  // 这样可以做到“平滑升级”，不需要清空历史队列。
  const payload = parseIngestionPayload(ingestionJob.payload);
  const resolvedFileName = fileName ?? payload.fileName;
  const resolvedMimeType = mimeType ?? payload.mimeType;
  const resolvedContentBase64 = contentBase64 ?? payload.contentBase64;

  await prisma.ingestionJob.update({
    where: { id: ingestionJob.id },
    data: { status: "RUNNING", errorMessage: null },
  });

  const version = await prisma.documentVersion.findUnique({ where: { id: versionId } });
  if (!version) {
    await markIngestionFailed(ingestionJob.id, "Document version not found");
    throw new Error("Document version not found");
  }

  let sections: DocumentParsedEvent["sections"] = [];
  // 解析优先级：
  // - 若版本里已有 rawText，直接按文本解析（成本更低）
  // - 否则按文件内容解析（PDF/DOCX/MD）
  // - 两者都没有则标记任务失败并抛错
  if (version.rawText && version.rawText.trim().length > 0) {
    sections = await parseText(version.sourceType, version.rawText);
  } else if (resolvedFileName && resolvedContentBase64 && resolvedMimeType) {
    sections = await parseFile({
      fileName: resolvedFileName,
      contentBase64: resolvedContentBase64,
      mimeType: resolvedMimeType,
    });
  } else {
    await markIngestionFailed(ingestionJob.id, "No parsable payload. Provide rawText or file content.");
    throw new Error("No parsable payload. Provide rawText or file content.");
  }

  await publishers.ingestion.add(PIPELINE_EVENTS.DOCUMENT_PARSED, {
    workspaceId,
    documentId,
    versionId,
    sections,
  });
}

/**
 * 函数说明：handleDocumentParsed，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
async function handleDocumentParsed(job: Job<DocumentParsedEvent>, publishers: QueuePublishers): Promise<void> {
  const { workspaceId, documentId, versionId, sections } = job.data;
  const chunks = chunkSections(sections);

  await prisma.documentChunk.deleteMany({
    where: { documentId, versionId },
  });

  // embedding 批量生成可显著降低模型调用开销，并提升吞吐。
  const embeddings = await embedMany(chunks.map((chunk) => chunk.content));

  if (chunks.length > 0) {
    await prisma.documentChunk.createMany({
      data: chunks.map((chunk, index) => ({
        id: chunk.chunkId,
        documentId,
        versionId,
        workspaceId,
        headingPath: chunk.headingPath,
        content: chunk.content,
        tokenEstimate: chunk.tokenEstimate,
        page: chunk.page,
        url: chunk.url,
        embeddingJson: embeddings[index],
      })),
    });
  }

  await publishers.ingestion.add(PIPELINE_EVENTS.DOCUMENT_EMBEDDED, {
    workspaceId,
    documentId,
    chunkCount: chunks.length,
  });
}

/**
 * 函数说明：handleDocumentEmbedded，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
async function handleDocumentEmbedded(job: Job<DocumentEmbeddedEvent>, publishers: QueuePublishers): Promise<void> {
  const { workspaceId, documentId } = job.data;

  const ingestionJob = await prisma.ingestionJob.findFirst({
    where: { workspaceId, documentId },
    orderBy: { createdAt: "desc" },
  });

  if (ingestionJob) {
    await prisma.ingestionJob.update({
      where: { id: ingestionJob.id },
      data: {
        status: "SUCCEEDED",
        errorMessage: null,
      },
    });
  }

  const versionCount = await prisma.documentVersion.count({ where: { documentId } });

  // 到达 embedded 阶段后，文档已具备检索条件：
  // - 发送 indexed 事件标记索引完成
  // - 触发自动摘要/标签流程（automation 队列）
  await publishers.ingestion.add(PIPELINE_EVENTS.DOCUMENT_INDEXED, {
    workspaceId,
    documentId,
    indexVersion: versionCount,
  });

  await publishers.automation.add(PIPELINE_EVENTS.DOCUMENT_AUTO_TAG_SUMMARY, {
    workspaceId,
    documentId,
  });
}

/**
 * 函数说明：markIngestionFailed，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
async function markIngestionFailed(jobId: string, reason: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage: reason,
    },
  });
}

/**
 * 函数说明：parseIngestionPayload，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function parseIngestionPayload(payload: unknown): {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    fileName: typeof record.fileName === "string" ? record.fileName : undefined,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
    contentBase64: typeof record.contentBase64 === "string" ? record.contentBase64 : undefined,
  };
}
