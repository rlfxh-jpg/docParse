import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { CrawlService } from "./crawl.service.js";
import { CreateCrawlJobDto } from "./dto/create-crawl-job.dto.js";

@Controller("crawl/jobs")
@UseGuards(JwtAuthGuard)
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrawlJobDto) {
    return this.crawlService.createJob(user.userId, dto);
  }
}
