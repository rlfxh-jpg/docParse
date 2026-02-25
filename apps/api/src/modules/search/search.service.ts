import { Injectable } from "@nestjs/common";
import { RagService } from "../rag/rag.service.js";

@Injectable()
export class SearchService {
  constructor(private readonly ragService: RagService) {}

  async search(userId: string, workspaceId: string, query: string) {
    const ranked = await this.ragService.search(userId, workspaceId, query);

    return ranked.map((item) => ({
      chunkId: item.chunkId,
      documentId: item.documentId,
      versionId: item.versionId,
      title: item.title,
      snippet: item.content.slice(0, 220),
      page: item.page,
      url: item.url,
      scores: {
        semantic: item.semanticScore,
        keyword: item.keywordScore,
        fused: item.fusedScore,
      },
    }));
  }
}
