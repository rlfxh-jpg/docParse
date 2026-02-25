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
  objectKey: string;
  fileName?: string;
  mimeType?: string;
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

export function createIngestionProcessor(publishers: QueuePublishers) {
  return async (job: Job): Promise<void> => {
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

async function handleDocumentUploaded(job: Job<DocumentUploadedEvent>, publishers: QueuePublishers): Promise<void> {
  const { workspaceId, documentId, versionId, fileName, mimeType, contentBase64 } = job.data;

  const ingestionJob = await prisma.ingestionJob.findFirst({
    where: { documentId, workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (!ingestionJob) {
    throw new Error("Ingestion job not found");
  }

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
  if (version.rawText && version.rawText.trim().length > 0) {
    sections = await parseText(version.sourceType, version.rawText);
  } else if (fileName && contentBase64 && mimeType) {
    sections = await parseFile({ fileName, contentBase64, mimeType });
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

async function handleDocumentParsed(job: Job<DocumentParsedEvent>, publishers: QueuePublishers): Promise<void> {
  const { workspaceId, documentId, versionId, sections } = job.data;
  const chunks = chunkSections(sections);

  await prisma.documentChunk.deleteMany({
    where: { documentId, versionId },
  });

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

async function markIngestionFailed(jobId: string, reason: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage: reason,
    },
  });
}
