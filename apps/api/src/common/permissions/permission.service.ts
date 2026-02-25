import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PermissionService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 函数说明：assertWorkspaceMember，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async assertWorkspaceMember(userId: string, workspaceId: string): Promise<WorkspaceRole> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      throw new ForbiddenException("No access to workspace");
    }

    return member.role;
  }

  /**
   * 函数说明：assertWorkspaceRole，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async assertWorkspaceRole(userId: string, workspaceId: string, allowed: WorkspaceRole[]): Promise<WorkspaceRole> {
    const role = await this.assertWorkspaceMember(userId, workspaceId);
    if (!allowed.includes(role)) {
      throw new ForbiddenException("Insufficient workspace role");
    }
    return role;
  }

  /**
   * 函数说明：assertDocumentReadAccess，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async assertDocumentReadAccess(userId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        shares: { where: { userId }, select: { id: true } },
      },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException("Document not found");
    }

    const role = await this.assertWorkspaceMember(userId, doc.workspaceId);
    if (role === "owner") {
      return;
    }

    const canRead =
      doc.createdById === userId ||
      doc.visibility === "workspace" ||
      (doc.visibility === "shared" && doc.shares.length > 0);

    if (!canRead) {
      throw new ForbiddenException("No document access");
    }
  }

  /**
   * 函数说明：assertDocumentWriteAccess，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async assertDocumentWriteAccess(userId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.deletedAt) {
      throw new NotFoundException("Document not found");
    }

    const role = await this.assertWorkspaceMember(userId, doc.workspaceId);
    if (role === "viewer") {
      throw new ForbiddenException("Viewer cannot modify document");
    }

    if (doc.visibility === "private" && doc.createdById !== userId && role !== "owner") {
      throw new ForbiddenException("Private document can only be edited by owner");
    }
  }
}
