import { Injectable, NotFoundException } from "@nestjs/common";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";

@Injectable()
export class IngestionService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  /**
   * 函数说明：getJob，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    await this.permissions.assertWorkspaceMember(userId, job.workspaceId);
    return job;
  }
}
