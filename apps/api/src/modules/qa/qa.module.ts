import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module.js";
import { RagModule } from "../rag/rag.module.js";
import { QaController } from "./qa.controller.js";
import { QaService } from "./qa.service.js";

@Module({
  imports: [RagModule, MetricsModule],
  controllers: [QaController],
  providers: [QaService],
})
export class QaModule {}
