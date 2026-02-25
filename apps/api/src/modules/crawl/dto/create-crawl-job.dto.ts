import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUrl, IsUUID, Max, Min } from "class-validator";

export class CreateCrawlJobDto {
  @IsUUID()
  workspaceId!: string;

  @IsUrl()
  seedUrl!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  depth?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxPages?: number = 5;
}
