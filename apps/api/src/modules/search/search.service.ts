import { Injectable } from "@nestjs/common";
import { RagService } from "../rag/rag.service.js";

@Injectable()
export class SearchService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(private readonly ragService: RagService) {}

  /**
   * 函数说明：search，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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
