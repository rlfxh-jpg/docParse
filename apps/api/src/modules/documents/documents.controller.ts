import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { DocumentsService } from "./documents.service.js";
import { ListDocumentsDto } from "./dto/list-documents.dto.js";
import { CreateDocumentDto } from "./dto/create-document.dto.js";
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

  @Post(":id/upload")
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

  @Post(":id/share")
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
