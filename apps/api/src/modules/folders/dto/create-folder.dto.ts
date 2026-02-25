import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateFolderDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
