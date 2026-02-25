import { Module } from "@nestjs/common";
import { RagService } from "./rag.service.js";
import { EmbeddingService } from "./embedding.service.js";
import { LlmService } from "./llm.service.js";

@Module({
  providers: [RagService, EmbeddingService, LlmService],
  exports: [RagService, EmbeddingService, LlmService],
})
export class RagModule {}
