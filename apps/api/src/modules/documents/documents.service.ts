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
   * 函数说明：list，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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
      // 权限裁剪策略：
      // - owner: 可查看空间内全部文档
      // - 非 owner: 仅可查看
      //   1) visibility=workspace 的文档
      //   2) 自己创建的文档
      //   3) 通过 document_shares 显式共享给自己的文档
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

  /**
   * 函数说明：create，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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

  /**
   * 函数说明：uploadVersion，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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
      // 上传版本的事务化流程（保证版本、当前指针、任务、审计一致）：
      // 第 1 步：落库一条不可变版本记录（DocumentVersion）
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

      // 第 2 步：把文档 currentVersion 指向最新版本，确保检索/问答优先读取新内容
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: version.id, updatedAt: new Date() },
      });

      // 第 3 步：把解析任务的上下文放入 ingestionJob.payload（含可选 base64）
      // 只在队列里传轻量指针，避免大 payload 直接进入 Redis 导致传输/内存压力。
      const ingestionPayload: Record<string, Prisma.InputJsonValue> = {
        versionId: version.id,
        sourceType: dto.sourceType,
      };
      if (dto.objectKey) {
        ingestionPayload.objectKey = dto.objectKey;
      }
      if (dto.fileName) {
        ingestionPayload.fileName = dto.fileName;
      }
      if (dto.mimeType) {
        ingestionPayload.mimeType = dto.mimeType;
      }
      if (dto.contentBase64) {
        ingestionPayload.contentBase64 = dto.contentBase64;
      }

      const ingestionJob = await tx.ingestionJob.create({
        data: {
          workspaceId: dto.workspaceId,
          documentId,
          status: "PENDING",
          payload: ingestionPayload as Prisma.InputJsonObject,
        },
      });

      // 第 4 步：写审计日志，便于追踪“谁在何时上传了哪个版本”
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

    // 队列事件仅发送标识信息，worker 再根据 ingestionJobId 回查 DB 获取完整 payload。
    await this.queueService.publishIngestion(PIPELINE_EVENTS.DOCUMENT_UPLOADED, {
      workspaceId: dto.workspaceId,
      documentId,
      versionId: result.version.id,
      ingestionJobId: result.ingestionJob.id,
      objectKey: dto.objectKey ?? "",
      fileName: dto.fileName,
      mimeType: dto.mimeType,
    });

    return {
      versionId: result.version.id,
      ingestionJobId: result.ingestionJob.id,
    };
  }

  /**
   * 函数说明：update，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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

  /**
   * 函数说明：listVersions，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async listVersions(userId: string, documentId: string) {
    await this.permissions.assertDocumentReadAccess(userId, documentId);

    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * 函数说明：share，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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

  /**
   * 函数说明：getAiMeta，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async getAiMeta(userId: string, documentId: string) {
    await this.permissions.assertDocumentReadAccess(userId, documentId);

    return this.prisma.documentAiMeta.findUnique({
      where: { documentId },
    });
  }
}
