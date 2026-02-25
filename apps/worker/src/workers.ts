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

/**
 * 函数说明：createPublishers，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export function createPublishers(): QueuePublishers {
  return {
    ingestion: new Queue(QUEUE_NAMES.INGESTION, { connection }),
    crawl: new Queue(QUEUE_NAMES.CRAWL, { connection }),
    automation: new Queue(QUEUE_NAMES.AUTOMATION, { connection }),
  };
}

/**
 * 函数说明：closePublishers，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function closePublishers(publishers: QueuePublishers): Promise<void> {
  await Promise.all([publishers.ingestion.close(), publishers.crawl.close(), publishers.automation.close()]);
  await connection.quit();
}
