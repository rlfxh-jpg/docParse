import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { AskQaDto } from "./dto/ask-qa.dto.js";
import { QaService } from "./qa.service.js";

@Controller("qa")
@UseGuards(JwtAuthGuard)
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Post("ask")
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
