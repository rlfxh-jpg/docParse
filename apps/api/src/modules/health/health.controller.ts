import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  /**
   * 函数说明：getHealth，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  getHealth(): { ok: boolean; service: string; timestamp: string } {
    return { ok: true, service: "api", timestamp: new Date().toISOString() };
  }
}
