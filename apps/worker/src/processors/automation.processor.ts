import { Job } from "bullmq";
import { PIPELINE_EVENTS } from "@smart-doc/shared";
import { prisma } from "../prisma.js";
import { summarizeAndTag } from "../services/ai.service.js";

interface AutomationEvent {
  workspaceId: string;
  documentId: string;
}

/**
 * 函数说明：automationProcessor，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function automationProcessor(job: Job<AutomationEvent>): Promise<void> {
  if (job.name !== PIPELINE_EVENTS.DOCUMENT_AUTO_TAG_SUMMARY) {
    throw new Error(`Unknown automation event: ${job.name}`);
  }

  const { documentId } = job.data;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      currentVersion: true,
      chunks: {
        take: 50,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!document) {
    throw new Error("Document not found");
  }

  const text =
    document.currentVersion?.rawText ||
    document.chunks.map((chunk) => chunk.content).join("\n\n") ||
    document.content ||
    document.title;

  const aiMeta = await summarizeAndTag(text.slice(0, 12000));

  await prisma.documentAiMeta.upsert({
    where: { documentId },
    update: {
      summary: aiMeta.summary,
      labels: aiMeta.labels,
      keywords: aiMeta.keywords,
    },
    create: {
      documentId,
      summary: aiMeta.summary,
      labels: aiMeta.labels,
      keywords: aiMeta.keywords,
    },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: {
      searchKeywords: aiMeta.keywords,
    },
  });
}
