import { Injectable, NotFoundException } from "@nestjs/common";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    await this.permissions.assertWorkspaceMember(userId, job.workspaceId);
    return job;
  }
}
