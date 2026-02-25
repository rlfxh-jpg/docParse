import { Job } from "bullmq";
import { PIPELINE_EVENTS } from "@smart-doc/shared";
import { prisma } from "../prisma.js";
import { parseWeb } from "../services/parser.service.js";
import { QueuePublishers } from "../workers.js";

interface CrawlRequestedEvent {
  workspaceId: string;
  jobId: string;
  seedUrl: string;
  depth: number;
  maxPages: number;
}

export function createCrawlProcessor(publishers: QueuePublishers) {
  return async (job: Job<CrawlRequestedEvent>): Promise<void> => {
    if (job.name !== PIPELINE_EVENTS.CRAWL_REQUESTED) {
      throw new Error(`Unknown crawl event: ${job.name}`);
    }

    const { workspaceId, jobId, seedUrl } = job.data;

    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", errorMessage: null },
    });

    try {
      const parsed = await parseWeb(seedUrl);

      const requester = await prisma.crawlJob.findUnique({ where: { id: jobId } });
      if (!requester) {
        throw new Error("Crawl job not found");
      }

      const document = await prisma.document.create({
        data: {
          workspaceId,
          createdById: requester.requestedById,
          title: parsed.title || seedUrl,
          visibility: "workspace",
          content: parsed.sections.map((s) => s.content).join("\n\n").slice(0, 10000),
        },
      });

      const version = await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          createdById: requester.requestedById,
          sourceType: "web_crawl",
          rawText: parsed.sections.map((s) => s.content).join("\n\n"),
          objectKey: seedUrl,
          mimeType: "text/html",
        },
      });

      await prisma.document.update({
        where: { id: document.id },
        data: {
          currentVersionId: version.id,
        },
      });

      await prisma.ingestionJob.create({
        data: {
          workspaceId,
          documentId: document.id,
          status: "PENDING",
          payload: {
            versionId: version.id,
            sourceType: "web_crawl",
            objectKey: seedUrl,
          },
        },
      });

      await publishers.ingestion.add(PIPELINE_EVENTS.DOCUMENT_PARSED, {
        workspaceId,
        documentId: document.id,
        versionId: version.id,
        sections: parsed.sections,
      });

      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: "SUCCEEDED",
          pagesCrawled: 1,
        },
      });
    } catch (error) {
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown crawl error",
        },
      });
      throw error;
    }
  };
}
