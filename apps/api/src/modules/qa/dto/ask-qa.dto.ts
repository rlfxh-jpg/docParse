import { IsString, IsUUID, MinLength } from "class-validator";

export class AskQaDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @MinLength(2)
  question!: string;
}
