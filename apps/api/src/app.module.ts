import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module.js";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module.js";
import { FoldersModule } from "./modules/folders/folders.module.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { CrawlModule } from "./modules/crawl/crawl.module.js";
import { IngestionModule } from "./modules/ingestion/ingestion.module.js";
import { SearchModule } from "./modules/search/search.module.js";
import { QaModule } from "./modules/qa/qa.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { MetricsModule } from "./modules/metrics/metrics.module.js";
import { PrismaModule } from "./common/prisma/prisma.module.js";
import { QueueModule } from "./common/queue/queue.module.js";
import { PermissionsModule } from "./common/permissions/permissions.module.js";
import { RagModule } from "./modules/rag/rag.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    PermissionsModule,
    RagModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    WorkspacesModule,
    FoldersModule,
    DocumentsModule,
    CrawlModule,
    IngestionModule,
    SearchModule,
    QaModule,
  ],
})
export class AppModule {}
