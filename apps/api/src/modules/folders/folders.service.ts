import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { CreateFolderDto } from "./dto/create-folder.dto.js";

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  async create(userId: string, dto: CreateFolderDto) {
    await this.permissions.assertWorkspaceRole(userId, dto.workspaceId, ["owner", "editor"]);

    if (dto.parentId) {
      const parent = await this.prisma.folder.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.workspaceId !== dto.workspaceId) {
        throw new NotFoundException("Parent folder not found");
      }
    }

    return this.prisma.folder.create({
      data: {
        workspaceId: dto.workspaceId,
        parentId: dto.parentId,
        name: dto.name,
      },
    });
  }
}
