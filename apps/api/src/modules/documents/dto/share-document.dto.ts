import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class ShareDocumentDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  userIds!: string[];
}
