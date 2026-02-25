import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { env } from "../../common/env.js";
import { JwtStrategy } from "../../common/auth/jwt.strategy.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_EXPIRES as any },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
