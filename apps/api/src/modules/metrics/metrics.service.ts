import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly requestDuration: Histogram<string>;
  private readonly qaCounter: Counter<string>;

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

  observeHttp(route: string, method: string, status: string, seconds: number): void {
    this.requestDuration.labels(route, method, status).observe(seconds);
  }

  countQa(outcome: "success" | "refused" | "error"): void {
    this.qaCounter.labels(outcome).inc();
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
