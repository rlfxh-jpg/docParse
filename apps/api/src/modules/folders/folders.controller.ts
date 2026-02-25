import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { FoldersService } from "./folders.service.js";
import { CreateFolderDto } from "./dto/create-folder.dto.js";

@Controller("folders")
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateFolderDto) {
    return this.foldersService.create(user.userId, dto);
  }
}
