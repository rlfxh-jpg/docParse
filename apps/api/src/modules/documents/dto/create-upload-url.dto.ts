import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateUploadUrlDto {
  @IsUUID()
  workspaceId!: string;

  @IsIn(["upload_pdf", "upload_docx", "upload_md"])
  sourceType!: "upload_pdf" | "upload_docx" | "upload_md";

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;
}

