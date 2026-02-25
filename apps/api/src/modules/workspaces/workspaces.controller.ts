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
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  /**
   * 函数说明：list，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async list(@CurrentUser() user: AuthUser) {
    return this.workspacesService.list(user.userId);
  }

  @Post()
  /**
   * 函数说明：create，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
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
