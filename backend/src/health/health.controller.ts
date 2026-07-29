import { Controller, Get } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";

// Mirrors the two unprefixed routes in
// backend-fastapi-archive/src/app/main.py (root "/" and "/health") — these
// live outside the "/api/v1" prefix applied to every other controller.
@Controller()
export class HealthController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  root() {
    return { status: "ok", app: this.config.appName, version: "1.0.0" };
  }

  @Get("health")
  health() {
    return { status: "healthy" };
  }
}
