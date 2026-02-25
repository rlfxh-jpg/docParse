import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { IngestionService } from "./ingestion.service.js";

@Controller("ingestion/jobs")
@UseGuards(JwtAuthGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get(":id")
  async getJob(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.ingestionService.getJob(user.userId, id);
  }
}
