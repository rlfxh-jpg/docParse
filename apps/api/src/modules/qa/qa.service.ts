import { Injectable, NotFoundException } from "@nestjs/common";
import { QaResponse } from "@smart-doc/shared";
import { Prisma } from "@prisma/client";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { MetricsService } from "../metrics/metrics.service.js";
import { RagService } from "../rag/rag.service.js";

@Injectable()
export class QaService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly ragService: RagService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * 函数说明：ask，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async ask(userId: string, workspaceId: string, question: string): Promise<{ sessionId: string } & QaResponse> {
    await this.permissions.assertWorkspaceMember(userId, workspaceId);

    const session = await this.prisma.qaSession.create({
      data: {
        workspaceId,
        userId,
        query: question,
      },
    });

    await this.prisma.qaMessage.create({
      data: {
        sessionId: session.id,
        role: "USER",
        content: question,
      },
    });

    try {
      const response = await this.ragService.answer(userId, workspaceId, question);

      await this.prisma.qaMessage.create({
        data: {
          sessionId: session.id,
          role: "ASSISTANT",
          content: response.answer,
          confidence: response.confidence,
          citations: response.citations as unknown as Prisma.InputJsonValue,
        },
      });

      this.metricsService.countQa(response.refused ? "refused" : "success");

      return {
        sessionId: session.id,
        ...response,
      };
    } catch (error) {
      this.metricsService.countQa("error");
      throw error;
    }
  }

  /**
   * 函数说明：getSessionAnswer，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async getSessionAnswer(userId: string, sessionId: string): Promise<{ sessionId: string } & QaResponse> {
    const session = await this.prisma.qaSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    await this.permissions.assertWorkspaceMember(userId, session.workspaceId);

    const assistant = [...session.messages].reverse().find((msg) => msg.role === "ASSISTANT");
    if (!assistant) {
      throw new NotFoundException("No assistant answer found");
    }

    const citations = Array.isArray(assistant.citations)
      ? (assistant.citations as unknown as QaResponse["citations"])
      : [];

    return {
      sessionId,
      answer: assistant.content,
      citations,
      confidence: assistant.confidence ?? 0,
      refused: citations.length === 0,
      refusalReason: citations.length === 0 ? "NO_EVIDENCE" : undefined,
    };
  }
}
