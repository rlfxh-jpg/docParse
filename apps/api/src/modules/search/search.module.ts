import { Module } from "@nestjs/common";
import { RagModule } from "../rag/rag.module.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  imports: [RagModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
