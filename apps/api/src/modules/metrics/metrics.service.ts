import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly requestDuration: Histogram<string>;
  private readonly qaCounter: Counter<string>;

  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.requestDuration = new Histogram({
      name: "api_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["route", "method", "status"],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 8],
      registers: [this.registry],
    });

    this.qaCounter = new Counter({
      name: "qa_requests_total",
      help: "Count of QA requests by outcome",
      labelNames: ["outcome"],
      registers: [this.registry],
    });
  }

  /**
   * 函数说明：observeHttp，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  observeHttp(route: string, method: string, status: string, seconds: number): void {
    this.requestDuration.labels(route, method, status).observe(seconds);
  }

  /**
   * 函数说明：countQa，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  countQa(outcome: "success" | "refused" | "error"): void {
    this.qaCounter.labels(outcome).inc();
  }

  /**
   * 函数说明：metrics，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
