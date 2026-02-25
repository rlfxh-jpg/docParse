import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAMES } from "@smart-doc/shared";
import { env } from "./env.js";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export interface QueuePublishers {
  ingestion: Queue;
  crawl: Queue;
  automation: Queue;
}

export function createPublishers(): QueuePublishers {
  return {
    ingestion: new Queue(QUEUE_NAMES.INGESTION, { connection }),
    crawl: new Queue(QUEUE_NAMES.CRAWL, { connection }),
    automation: new Queue(QUEUE_NAMES.AUTOMATION, { connection }),
  };
}

export async function closePublishers(publishers: QueuePublishers): Promise<void> {
  await Promise.all([publishers.ingestion.close(), publishers.crawl.close(), publishers.automation.close()]);
  await connection.quit();
}
