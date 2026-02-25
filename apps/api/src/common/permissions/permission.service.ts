import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWorkspaceMember(userId: string, workspaceId: string): Promise<WorkspaceRole> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      throw new ForbiddenException("No access to workspace");
    }

    return member.role;
  }

  async assertWorkspaceRole(userId: string, workspaceId: string, allowed: WorkspaceRole[]): Promise<WorkspaceRole> {
    const role = await this.assertWorkspaceMember(userId, workspaceId);
    if (!allowed.includes(role)) {
      throw new ForbiddenException("Insufficient workspace role");
    }
    return role;
  }

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
