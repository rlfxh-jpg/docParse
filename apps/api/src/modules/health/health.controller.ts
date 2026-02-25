import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): { ok: boolean; service: string; timestamp: string } {
    return { ok: true, service: "api", timestamp: new Date().toISOString() };
  }
}
