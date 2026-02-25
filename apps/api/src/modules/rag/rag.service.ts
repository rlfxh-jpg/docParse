import { Injectable } from "@nestjs/common";
import { QaResponse, RAG_DEFAULTS, REFUSAL_MESSAGE } from "@smart-doc/shared";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { EmbeddingService } from "./embedding.service.js";
import { AnswerContext, LlmService } from "./llm.service.js";

interface RankedChunk {
  chunkId: string;
  documentId: string;
  versionId: string;
  title: string;
  sourceType: "upload_pdf" | "upload_docx" | "upload_md" | "web_crawl";
  content: string;
  page?: number;
  url?: string;
  semanticScore: number;
  keywordScore: number;
  fusedScore: number;
}

@Injectable()
export class RagService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly embeddingService: EmbeddingService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * 函数说明：search，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async search(userId: string, workspaceId: string, query: string): Promise<RankedChunk[]> {
    await this.permissions.assertWorkspaceMember(userId, workspaceId);

    const accessibleDocumentIds = await this.getAccessibleDocumentIds(userId, workspaceId);
    if (accessibleDocumentIds.length === 0) {
      return [];
    }

    // 先基于权限得到可访问文档集合，再拉取候选分块。
    // 当前 MVP 规模下采用“应用内重排”实现，逻辑直观且便于调试；
    // 后续数据量上来可迁移为数据库/向量引擎侧重排。
    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        workspaceId,
        documentId: { in: accessibleDocumentIds },
      },
      include: {
        document: {
          select: {
            title: true,
          },
        },
        version: {
          select: {
            sourceType: true,
          },
        },
      },
      take: 2500,
    });

    if (chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddingService.embedOne(query);

    // 混合检索策略：
    // - 语义通道：embedding 余弦相似度
    // - 关键词通道：query 与 chunk 的词面匹配
    // 最终使用 RRF 融合两路排序，兼顾召回范围与相关性稳定性。
    const semanticRanked = chunks
      .map((chunk) => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, (chunk.embeddingJson as number[] | null) ?? []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RAG_DEFAULTS.vectorTopK);

    const keywordRanked = chunks
      .map((chunk) => ({
        chunk,
        score: this.keywordScore(query, chunk.content),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RAG_DEFAULTS.keywordTopK);

    const fusedMap = new Map<string, RankedChunk>();

    // RRF 常量 60 是常见经验值，可减少单路排序波动对最终结果的影响。
    const rrf = (rank: number) => 1 / (60 + rank);

    semanticRanked.forEach((item, index) => {
      const key = item.chunk.id;
      const existing = fusedMap.get(key);
      const base = existing ?? this.toRankedChunk(item.chunk, item.score, 0);
      base.semanticScore = item.score;
      base.fusedScore += rrf(index + 1);
      fusedMap.set(key, base);
    });

    keywordRanked.forEach((item, index) => {
      const key = item.chunk.id;
      const existing = fusedMap.get(key);
      const base = existing ?? this.toRankedChunk(item.chunk, 0, item.score);
      base.keywordScore = item.score;
      base.fusedScore += rrf(index + 1);
      fusedMap.set(key, base);
    });

    return Array.from(fusedMap.values())
      .sort((a, b) => b.fusedScore - a.fusedScore)
      .slice(0, RAG_DEFAULTS.fusedTopK);
  }

  /**
   * 函数说明：answer，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async answer(userId: string, workspaceId: string, question: string): Promise<QaResponse> {
    const ranked = await this.search(userId, workspaceId, question);
    const contexts = ranked.slice(0, RAG_DEFAULTS.contextTopK).map((item) => this.toAnswerContext(item));

    // 无证据直接拒答，避免模型在缺少依据时“猜答案”。
    if (contexts.length === 0) {
      return {
        answer: REFUSAL_MESSAGE,
        citations: [],
        confidence: 0,
        refused: true,
        refusalReason: "NO_EVIDENCE",
      };
    }

    // 交由 LLM 生成答案，模型会返回引用 chunkId 与置信度。
    const response = await this.llmService.generateAnswer(question, contexts);

    if (response.refused) {
      return response;
    }

    // 二次安全阈值：
    // - 引用为空：判定为无证据
    // - 置信度低于阈值：判定为低置信回答，统一拒答
    if (response.citations.length === 0 || response.confidence < RAG_DEFAULTS.minConfidence) {
      return {
        answer: REFUSAL_MESSAGE,
        citations: [],
        confidence: response.confidence,
        refused: true,
        refusalReason: response.citations.length === 0 ? "NO_EVIDENCE" : "LOW_CONFIDENCE",
      };
    }

    // 引用合法性校验：
    // 只允许引用本轮提供给模型的上下文 chunk，防止“凭空引用”。
    const validChunkIds = new Set(contexts.map((ctx) => ctx.chunkId));
    const hasInvalidCitation = response.citations.some((c) => !validChunkIds.has(c.chunkId));

    if (hasInvalidCitation) {
      return {
        answer: REFUSAL_MESSAGE,
        citations: [],
        confidence: 0,
        refused: true,
        refusalReason: "NO_EVIDENCE",
      };
    }

    return response;
  }

  /**
   * 函数说明：getAccessibleDocumentIds，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private async getAccessibleDocumentIds(userId: string, workspaceId: string): Promise<string[]> {
    const role = await this.permissions.assertWorkspaceMember(userId, workspaceId);

    if (role === "owner") {
      const docs = await this.prisma.document.findMany({
        where: { workspaceId, deletedAt: null },
        select: { id: true },
      });
      return docs.map((d) => d.id);
    }

    const docs = await this.prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [
          { visibility: "workspace" },
          { createdById: userId },
          { shares: { some: { userId } } },
        ],
      },
      select: { id: true },
    });

    return docs.map((d) => d.id);
  }

  /**
   * 函数说明：toRankedChunk，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private toRankedChunk(chunk: any, semanticScore: number, keywordScore: number): RankedChunk {
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      versionId: chunk.versionId,
      title: chunk.document.title,
      sourceType: chunk.version.sourceType,
      content: chunk.content,
      page: chunk.page ?? undefined,
      url: chunk.url ?? undefined,
      semanticScore,
      keywordScore,
      fusedScore: 0,
    };
  }

  /**
   * 函数说明：toAnswerContext，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private toAnswerContext(item: RankedChunk): AnswerContext {
    return {
      chunkId: item.chunkId,
      content: item.content,
      title: item.title,
      sourceType: item.sourceType,
      documentId: item.documentId,
      versionId: item.versionId,
      page: item.page,
      url: item.url,
    };
  }

  /**
   * 函数说明：cosineSimilarity，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    const len = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;

    for (let i = 0; i < len; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }

    if (na === 0 || nb === 0) {
      return 0;
    }

    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /**
   * 函数说明：keywordScore，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private keywordScore(query: string, content: string): number {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return 0;
    }

    const lower = content.toLowerCase();
    let score = 0;

    tokens.forEach((token) => {
      if (lower.includes(token)) {
        score += 1;
      }
    });

    score += lower.includes(query.toLowerCase()) ? 1 : 0;
    return score;
  }
}
