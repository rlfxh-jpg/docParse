import { IsString, IsUUID, MinLength } from "class-validator";

export class SearchDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @MinLength(1)
  query!: string;
}
