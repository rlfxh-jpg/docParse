import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class ListDocumentsDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
