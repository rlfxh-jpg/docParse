import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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
