import { Injectable, ConflictException, UnauthorizedException, Inject } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { env } from "../../common/env.js";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  /**
   * 函数说明：register，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async register(input: RegisterDto): Promise<{ id: string; email: string; name: string } & TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing?.status === "ACTIVE") {
      throw new ConflictException("Email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            name: input.name,
            status: "ACTIVE",
          },
        })
      : await this.prisma.user.create({
          data: {
            email: input.email.toLowerCase(),
            passwordHash,
            name: input.name,
            status: "ACTIVE",
          },
        });

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      ...tokens,
    };
  }

  /**
   * 函数说明：login，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async login(input: LoginDto): Promise<{ id: string; email: string; name: string } & TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !user.passwordHash || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      ...tokens,
    };
  }

  /**
   * 函数说明：refresh，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
      return this.issueTokens(payload.sub, payload.email);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  /**
   * 函数说明：issueTokens，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES as any,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES as any,
      },
    );

    return { accessToken, refreshToken };
  }
}
