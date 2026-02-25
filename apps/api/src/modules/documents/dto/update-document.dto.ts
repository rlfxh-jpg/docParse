import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateDocumentDto {
  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(["private", "workspace", "shared"])
  visibility?: "private" | "workspace" | "shared";
}
