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

  /**
   * 函数说明：publishIngestion，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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

  /**
   * 函数说明：publishCrawl，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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

  /**
   * 函数说明：publishAutomation，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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

  /**
   * 函数说明：onModuleDestroy，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.ingestionQueue.close(),
      this.crawlQueue.close(),
      this.automationQueue.close(),
      this.connection.quit(),
    ]);
  }
}
