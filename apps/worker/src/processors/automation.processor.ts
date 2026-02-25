import { Job } from "bullmq";
import { PIPELINE_EVENTS } from "@smart-doc/shared";
import { prisma } from "../prisma.js";
import { summarizeAndTag } from "../services/ai.service.js";

interface AutomationEvent {
  workspaceId: string;
  documentId: string;
}

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
