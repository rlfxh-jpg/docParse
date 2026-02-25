import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";

@Controller("auth")
export class AuthController {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  /**
   * 函数说明：register，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(reply, result.refreshToken);
    return {
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
      },
      accessToken: result.accessToken,
    };
  }

  @Post("login")
  /**
   * 函数说明：login，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(reply, result.refreshToken);
    return {
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
      },
      accessToken: result.accessToken,
    };
  }

  @Post("refresh")
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const tokenFromCookie = (request.cookies?.refresh_token as string | undefined) ?? undefined;
    const refreshToken = dto.refreshToken ?? tokenFromCookie;

    if (!refreshToken) {
      return { error: "Refresh token required" };
    }

    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(reply, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  @Post("logout")
  /**
   * 函数说明：logout，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie("refresh_token", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return { ok: true };
  }

  /**
   * 函数说明：setRefreshCookie，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private setRefreshCookie(reply: FastifyReply, refreshToken: string): void {
    reply.setCookie("refresh_token", refreshToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}
