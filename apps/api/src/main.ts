import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import * as Sentry from "@sentry/node";
import { env } from "./common/env.js";

/**
 * 函数说明：bootstrap，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
async function bootstrap(): Promise<void> {
  // 在 ESM 场景下，静态 import 可能导致装饰器类先于 reflect-metadata 执行，
  // 进而出现依赖注入元数据缺失。这里使用动态 import，确保元数据系统先完成初始化。
  const { AppModule } = await import("./app.module.js");

  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      tracesSampleRate: 0.2,
      environment: env.NODE_ENV,
    });
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // 文档上传会经过 base64 JSON 传输，体积通常远大于 Fastify 默认 1MB 限制，
    // 这里统一提升到 50MB，避免上传阶段被网关层提前拒绝。
    new FastifyAdapter({ logger: true, bodyLimit: 50 * 1024 * 1024 }),
  );

  await app.register(cookie as any);
  await app.register(multipart as any, {
    limits: { fileSize: 30 * 1024 * 1024 },
  });

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      // 统一在入口层完成 DTO 转换与字段白名单过滤：
      // 1) transform: 自动把 query/body 转成 DTO 类型
      // 2) whitelist: 过滤未声明字段，降低脏数据进入业务层的风险
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
