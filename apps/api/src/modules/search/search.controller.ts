import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { SearchDto } from "./dto/search.dto.js";
import { SearchService } from "./search.service.js";

@Controller("search")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async search(@CurrentUser() user: AuthUser, @Body() dto: SearchDto) {
    return this.searchService.search(user.userId, dto.workspaceId, dto.query);
  }
}
