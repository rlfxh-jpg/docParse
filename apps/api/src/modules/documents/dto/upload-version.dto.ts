import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, IsUUID } from "class-validator";

export class UploadDocumentVersionDto {
  @IsUUID()
  workspaceId!: string;

  @IsIn(["upload_pdf", "upload_docx", "upload_md", "web_crawl"])
  sourceType!: "upload_pdf" | "upload_docx" | "upload_md" | "web_crawl";

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  objectKey?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  checksum?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  contentBase64?: string;
}
