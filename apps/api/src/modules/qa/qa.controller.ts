import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { AskQaDto } from "./dto/ask-qa.dto.js";
import { QaService } from "./qa.service.js";

@Controller("qa")
@UseGuards(JwtAuthGuard)
export class QaController {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(private readonly qaService: QaService) {}

  @Post("ask")
  /**
   * 函数说明：ask，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async ask(@CurrentUser() user: AuthUser, @Body() dto: AskQaDto) {
    return this.qaService.ask(user.userId, dto.workspaceId, dto.question);
  }

  @Get("stream/:sessionId")
  async stream(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Req() _req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const response = await this.qaService.getSessionAnswer(user.userId, sessionId);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    reply.raw.write(`event: final\ndata: ${JSON.stringify(response)}\n\n`);
    reply.raw.write("event: done\ndata: {}\n\n");
    reply.raw.end();
  }
}
