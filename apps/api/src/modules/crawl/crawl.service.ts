import { Injectable } from "@nestjs/common";
import { QueueService } from "../../common/queue/queue.service.js";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CreateCrawlJobDto } from "./dto/create-crawl-job.dto.js";

@Injectable()
export class CrawlService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly permissions: PermissionService,
  ) {}

  /**
   * 函数说明：createJob，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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
