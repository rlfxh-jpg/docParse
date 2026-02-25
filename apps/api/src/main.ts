import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import * as Sentry from "@sentry/node";
import { AppModule } from "./app.module.js";
import { env } from "./common/env.js";

async function bootstrap(): Promise<void> {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      tracesSampleRate: 0.2,
      environment: env.NODE_ENV,
    });
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
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
