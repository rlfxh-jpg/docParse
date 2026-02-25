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

/**
 * 函数说明：bootstrap，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
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

  /**
   * 函数说明：shutdown，统一处理 Worker 进程的优雅关闭。
   * 执行流程：按顺序关闭队列消费者、消息发布器、Redis 连接与数据库连接，
   * 最后显式退出进程，避免未释放句柄导致进程悬挂。
   * 参数约定：无外部参数，直接使用 bootstrap 作用域内已创建的资源实例。
   * 返回结果：异步完成所有资源释放；若某一步抛错将交给 Node 进程级异常处理。
   */
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
