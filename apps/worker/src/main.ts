import "dotenv/config";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAMES } from "@smart-doc/shared";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { createIngestionProcessor } from "./processors/ingestion.processor.js";
import { createCrawlProcessor } from "./processors/crawl.processor.js";
import { automationProcessor } from "./processors/automation.processor.js";
import { createPublishers, closePublishers } from "./workers.js";

async function bootstrap(): Promise<void> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const publishers = createPublishers();

  const ingestionWorker = new Worker(QUEUE_NAMES.INGESTION, createIngestionProcessor(publishers), {
    connection,
    concurrency: 4,
  });

  const crawlWorker = new Worker(QUEUE_NAMES.CRAWL, createCrawlProcessor(publishers), {
    connection,
    concurrency: 2,
  });

  const automationWorker = new Worker(QUEUE_NAMES.AUTOMATION, automationProcessor, {
    connection,
    concurrency: 3,
  });

  const workers = [ingestionWorker, crawlWorker, automationWorker];

  workers.forEach((worker) => {
    worker.on("completed", (job) => {
      console.log(`[worker:${worker.name}] completed job ${job.id} (${job.name})`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[worker:${worker.name}] failed job ${job?.id} (${job?.name}):`, err.message);
    });
  });

  console.log("Worker service started.");

  const shutdown = async () => {
    console.log("Shutting down workers...");
    await Promise.all(workers.map((worker) => worker.close()));
    await closePublishers(publishers);
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch(async (error) => {
  console.error("Worker bootstrap failed", error);
  await prisma.$disconnect();
  process.exit(1);
});
