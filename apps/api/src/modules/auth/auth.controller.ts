import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
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
  async logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie("refresh_token", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return { ok: true };
  }

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
