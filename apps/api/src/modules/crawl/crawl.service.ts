import { Injectable } from "@nestjs/common";
import { QueueService } from "../../common/queue/queue.service.js";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CreateCrawlJobDto } from "./dto/create-crawl-job.dto.js";

@Injectable()
export class CrawlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly permissions: PermissionService,
  ) {}

  async createJob(userId: string, dto: CreateCrawlJobDto) {
    await this.permissions.assertWorkspaceRole(userId, dto.workspaceId, ["owner", "editor"]);

    const job = await this.prisma.crawlJob.create({
      data: {
        workspaceId: dto.workspaceId,
        requestedById: userId,
        seedUrl: dto.seedUrl,
        depth: dto.depth ?? 1,
        maxPages: dto.maxPages ?? 5,
      },
    });

    await this.queueService.publishCrawl({
      workspaceId: dto.workspaceId,
      jobId: job.id,
      seedUrl: dto.seedUrl,
      depth: dto.depth ?? 1,
      maxPages: dto.maxPages ?? 5,
    });

    return job;
  }
}
