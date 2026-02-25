import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateDocumentDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(["private", "workspace", "shared"])
  visibility?: "private" | "workspace" | "shared";
}
