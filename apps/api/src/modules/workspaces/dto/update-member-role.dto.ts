import { IsIn } from "class-validator";

export class UpdateMemberRoleDto {
  @IsIn(["owner", "editor", "viewer"])
  role!: "owner" | "editor" | "viewer";
}
