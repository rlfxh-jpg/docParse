import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PIPELINE_EVENTS } from "@smart-doc/shared";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { QueueService } from "../../common/queue/queue.service.js";
import { PermissionService } from "../../common/permissions/permission.service.js";
import { CreateDocumentDto } from "./dto/create-document.dto.js";
import { ListDocumentsDto } from "./dto/list-documents.dto.js";
import { ShareDocumentDto } from "./dto/share-document.dto.js";
import { UpdateDocumentDto } from "./dto/update-document.dto.js";
import { UploadDocumentVersionDto } from "./dto/upload-version.dto.js";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly permissions: PermissionService,
  ) {}

  async list(userId: string, dto: ListDocumentsDto) {
    const role = await this.permissions.assertWorkspaceMember(userId, dto.workspaceId);
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: Prisma.DocumentWhereInput = {
      workspaceId: dto.workspaceId,
      deletedAt: null,
      folderId: dto.folderId,
      ...(dto.keyword
        ? {
            OR: [
              { title: { contains: dto.keyword, mode: "insensitive" } },
              { content: { contains: dto.keyword, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(dto.tag ? { aiMeta: { is: { labels: { has: dto.tag } } } } : {}),
    };

    if (role !== "owner") {
      where.AND = [
        {
          OR: [
            { visibility: "workspace" },
            { createdById: userId },
            { shares: { some: { userId } } },
          ],
        },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: {
          aiMeta: true,
          currentVersion: {
            select: {
              id: true,
              sourceType: true,
              createdAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items,
    };
  }

  async create(userId: string, dto: CreateDocumentDto) {
    await this.permissions.assertWorkspaceRole(userId, dto.workspaceId, ["owner", "editor"]);

    return this.prisma.document.create({
      data: {
        workspaceId: dto.workspaceId,
        folderId: dto.folderId,
        createdById: userId,
        title: dto.title,
        content: dto.content,
        visibility: dto.visibility ?? "private",
      },
    });
  }

  async uploadVersion(userId: string, documentId: string, dto: UploadDocumentVersionDto) {
    await this.permissions.assertDocumentWriteAccess(userId, documentId);

    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    if (document.workspaceId !== dto.workspaceId) {
      throw new ForbiddenException("Workspace mismatch");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.create({
        data: {
          documentId,
          createdById: userId,
          sourceType: dto.sourceType,
          objectKey: dto.objectKey,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          checksum: dto.checksum,
          rawText: dto.rawText,
        },
      });

      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: version.id, updatedAt: new Date() },
      });

      const ingestionJob = await tx.ingestionJob.create({
        data: {
          workspaceId: dto.workspaceId,
          documentId,
          status: "PENDING",
          payload: {
            versionId: version.id,
            sourceType: dto.sourceType,
            objectKey: dto.objectKey,
            fileName: dto.fileName,
            mimeType: dto.mimeType,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: dto.workspaceId,
          userId,
          action: "DOCUMENT_VERSION_UPLOADED",
          targetType: "document",
          targetId: documentId,
          details: {
            versionId: version.id,
            sourceType: dto.sourceType,
          },
        },
      });

      return { version, ingestionJob };
    });

    await this.queueService.publishIngestion(PIPELINE_EVENTS.DOCUMENT_UPLOADED, {
      workspaceId: dto.workspaceId,
      documentId,
      versionId: result.version.id,
      objectKey: dto.objectKey ?? "",
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      contentBase64: dto.contentBase64,
    });

    return {
      versionId: result.version.id,
      ingestionJobId: result.ingestionJob.id,
    };
  }

  async update(userId: string, documentId: string, dto: UpdateDocumentDto) {
    await this.permissions.assertDocumentWriteAccess(userId, documentId);

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        folderId: dto.folderId,
        title: dto.title,
        content: dto.content,
        visibility: dto.visibility,
      },
    });
  }

  async listVersions(userId: string, documentId: string) {
    await this.permissions.assertDocumentReadAccess(userId, documentId);

    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async share(userId: string, documentId: string, dto: ShareDocumentDto) {
    await this.permissions.assertDocumentWriteAccess(userId, documentId);

    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentShare.deleteMany({ where: { documentId } });

      if (dto.userIds.length > 0) {
        await tx.documentShare.createMany({
          data: dto.userIds.map((uid) => ({
            documentId,
            userId: uid,
          })),
          skipDuplicates: true,
        });
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          visibility: "shared",
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: document.workspaceId,
          userId,
          action: "DOCUMENT_SHARED_UPDATED",
          targetType: "document",
          targetId: documentId,
          details: {
            sharedTo: dto.userIds,
          },
        },
      });
    });

    return { ok: true };
  }

  async getAiMeta(userId: string, documentId: string) {
    await this.permissions.assertDocumentReadAccess(userId, documentId);

    return this.prisma.documentAiMeta.findUnique({
      where: { documentId },
    });
  }
}
