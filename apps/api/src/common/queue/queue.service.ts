import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { PIPELINE_EVENTS, QUEUE_NAMES } from "@smart-doc/shared";
import { env } from "../env.js";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  private readonly ingestionQueue = new Queue(QUEUE_NAMES.INGESTION, { connection: this.connection });
  private readonly crawlQueue = new Queue(QUEUE_NAMES.CRAWL, { connection: this.connection });
  private readonly automationQueue = new Queue(QUEUE_NAMES.AUTOMATION, { connection: this.connection });

  async publishIngestion(eventName: string, payload: unknown): Promise<void> {
    const attempts = eventName === PIPELINE_EVENTS.DOCUMENT_EMBEDDED ? 2 : 3;
    await this.ingestionQueue.add(eventName, payload, {
      attempts,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }

  async publishCrawl(payload: unknown): Promise<void> {
    await this.crawlQueue.add(PIPELINE_EVENTS.CRAWL_REQUESTED, payload, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }

  async publishAutomation(payload: unknown): Promise<void> {
    await this.automationQueue.add(PIPELINE_EVENTS.DOCUMENT_AUTO_TAG_SUMMARY, payload, {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.ingestionQueue.close(),
      this.crawlQueue.close(),
      this.automationQueue.close(),
      this.connection.quit(),
    ]);
  }
}
