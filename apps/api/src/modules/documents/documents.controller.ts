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
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() dto: ListDocumentsDto) {
    return this.documentsService.list(user.userId, dto);
  }

  @Post()
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
  async aiMeta(@CurrentUser() user: AuthUser, @Param("id") documentId: string) {
    return this.documentsService.getAiMeta(user.userId, documentId);
  }
}
