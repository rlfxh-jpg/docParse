import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  userId: string;
  email: string;
}

/**
 * 函数说明：CurrentUser 参数装饰器，从请求上下文提取已认证用户信息。
 * 执行流程：读取 Fastify/Nest 注入到 request 的 `user` 字段，并转换为 AuthUser 类型返回。
 * 参数约定：第 1 个参数为装饰器 data（当前未使用）；第 2 个参数为 ExecutionContext。
 * 返回结果：返回标准化的 `AuthUser` 对象，供控制器方法直接注入当前用户。
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as AuthUser;
});
