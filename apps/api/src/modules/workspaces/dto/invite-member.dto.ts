import { IsEmail, IsIn } from "class-validator";

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(["owner", "editor", "viewer"])
  role!: "owner" | "editor" | "viewer";
}
