import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { WorkspacesService } from "./workspaces.service.js";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto.js";
import { InviteMemberDto } from "./dto/invite-member.dto.js";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto.js";

@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.workspacesService.list(user.userId);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.userId, dto);
  }

  @Post(":id/invite")
  async invite(
    @CurrentUser() user: AuthUser,
    @Param("id") workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspacesService.invite(workspaceId, user.userId, dto);
  }

  @Patch(":id/members/:userId")
  async updateRole(
    @CurrentUser() user: AuthUser,
    @Param("id") workspaceId: string,
    @Param("userId") memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(workspaceId, memberUserId, user.userId, dto);
  }
}
