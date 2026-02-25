import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { DocumentsService } from "./documents.service.js";
import { ListDocumentsDto } from "./dto/list-documents.dto.js";
import { CreateDocumentDto } from "./dto/create-document.dto.js";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto.js";
import { UploadDocumentVersionDto } from "./dto/upload-version.dto.js";
import { UpdateDocumentDto } from "./dto/update-document.dto.js";
import { ShareDocumentDto } from "./dto/share-document.dto.js";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  /**
   * 函数说明：list，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async list(@CurrentUser() user: AuthUser, @Query() dto: ListDocumentsDto) {
    return this.documentsService.list(user.userId, dto);
  }

  @Post()
  /**
   * 函数说明：create，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(user.userId, dto);
  }

  @Post(":id/upload-url")
  /**
   * 函数说明：createUploadUrl，生成文档版本文件直传对象存储所需的预签名 URL。
   * 执行流程：先做写权限与空间归属校验，再返回 uploadUrl 与 objectKey 给前端直传。
   * 参数约定：id 为文档 ID；请求体包含 workspaceId、sourceType、fileName 与可选 mimeType。
   * 返回结果：返回上传 URL、对象键、过期时间与建议请求头，供客户端执行 PUT 上传。
   */
  async createUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param("id") documentId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.documentsService.createUploadUrl(user.userId, documentId, dto);
  }

  @Post(":id/upload")
  /**
   * 函数说明：upload，登记上传后的文档版本并触发入库队列。
   * 执行流程：保存版本元数据、创建 ingestion job，然后发布 `document.uploaded` 事件。
   * 参数约定：请求体可传 objectKey（对象存储模式）或 contentBase64/rawText（兼容模式）。
   * 返回结果：返回 versionId 与 ingestionJobId，前端可据此轮询任务状态。
   */
  async upload(
    @CurrentUser() user: AuthUser,
    @Param("id") documentId: string,
    @Body() dto: UploadDocumentVersionDto,
  ) {
    return this.documentsService.uploadVersion(user.userId, documentId, dto);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") documentId: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(user.userId, documentId, dto);
  }

  @Get(":id/versions")
  /**
   * 函数说明：versions，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async versions(@CurrentUser() user: AuthUser, @Param("id") documentId: string) {
    return this.documentsService.listVersions(user.userId, documentId);
  }

  @Get(":id/versions/:versionId/download-url")
  /**
   * 函数说明：downloadUrl，生成指定版本文件的下载预签名 URL。
   * 执行流程：校验读权限并确认版本存在 objectKey，然后返回一次性下载链接。
   * 参数约定：id 为文档 ID，versionId 为版本 ID，二者必须匹配同一版本记录。
   * 返回结果：返回 downloadUrl 与过期时间，供前端直接下载文件。
   */
  async downloadUrl(
    @CurrentUser() user: AuthUser,
    @Param("id") documentId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.documentsService.getVersionDownloadUrl(user.userId, documentId, versionId);
  }

  @Post(":id/share")
  /**
   * 函数说明：share，更新文档级共享名单与可见性状态。
   * 执行流程：清空旧共享、写入新共享列表、更新文档可见性并记录审计日志。
   * 参数约定：id 为文档 ID；请求体 userIds 表示被共享用户集合。
   * 返回结果：返回 `ok: true` 表示共享配置已成功落库。
   */
  async share(
    @CurrentUser() user: AuthUser,
    @Param("id") documentId: string,
    @Body() dto: ShareDocumentDto,
  ) {
    return this.documentsService.share(user.userId, documentId, dto);
  }

  @Get(":id/ai-meta")
  /**
   * 函数说明：aiMeta，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async aiMeta(@CurrentUser() user: AuthUser, @Param("id") documentId: string) {
    return this.documentsService.getAiMeta(user.userId, documentId);
  }
}
