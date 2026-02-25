import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto.js";
import { InviteMemberDto } from "./dto/invite-member.dto.js";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto.js";

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { workspace: { updatedAt: "desc" } },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      ownerId: m.workspace.ownerId,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
    }));
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "owner",
        },
      });

      return workspace;
    });
  }

  async invite(workspaceId: string, operatorId: string, dto: InviteMemberDto) {
    await this.permissions.assertWorkspaceRole(operatorId, workspaceId, ["owner"]);

    const email = dto.email.toLowerCase();
    const role = dto.role as WorkspaceRole;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    const user =
      existingUser ??
      (await this.prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
          status: "INVITED",
          passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
        },
      }));

    const membership = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      update: { role },
      create: {
        workspaceId,
        userId: user.id,
        role,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        userId: operatorId,
        action: "WORKSPACE_MEMBER_INVITED",
        targetType: "workspace_member",
        targetId: membership.id,
        details: {
          email,
          role,
        },
      },
    });

    return {
      userId: user.id,
      email: user.email,
      role: membership.role,
    };
  }

  async updateMemberRole(workspaceId: string, memberUserId: string, operatorId: string, dto: UpdateMemberRoleDto) {
    await this.permissions.assertWorkspaceRole(operatorId, workspaceId, ["owner"]);

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: dto.role as WorkspaceRole },
    });

    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        userId: operatorId,
        action: "WORKSPACE_MEMBER_ROLE_UPDATED",
        targetType: "workspace_member",
        targetId: updated.id,
        details: {
          role: updated.role,
        },
      },
    });

    return {
      userId: updated.userId,
      role: updated.role,
    };
  }
}
