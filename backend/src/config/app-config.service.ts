import { Injectable } from "@nestjs/common";

// Placeholder values that must never be treated as a real secret in any
// deployment — mirrors backend-fastapi-archive/src/app/config.py exactly.
const SECRET_KEY_PLACEHOLDERS = new Set([
  "",
  "change-me-in-production",
  "dev-secret-key-change-in-production",
  "your-secret-key-here-change-in-production",
]);

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.trim().toLowerCase() !== "false" && value.trim() !== "0";
}

@Injectable()
export class AppConfigService {
  readonly appName: string;
  readonly appEnv: string;
  readonly debug: boolean;
  readonly secretKey: string;

  readonly databaseUrl: string;

  readonly anthropicApiKey: string;

  readonly frontendUrl: string;
  readonly allowedOrigin: string;

  readonly publicDemoMode: boolean;
  readonly demoResetIntervalMinutes: number;

  readonly port: number;

  constructor() {
    this.appName = process.env.APP_NAME || "AI Revenue Recovery Agent";
    this.appEnv = process.env.APP_ENV || "development";
    this.debug = parseBool(process.env.DEBUG, false);

    const secretKey = (process.env.SECRET_KEY ?? "").trim();
    if (SECRET_KEY_PLACEHOLDERS.has(secretKey)) {
      throw new Error(
        "SECRET_KEY must be set to a real, generated value via the SECRET_KEY " +
          "environment variable — it cannot be blank or use a placeholder default. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    this.secretKey = secretKey;

    this.databaseUrl = process.env.DATABASE_URL || "file:./revenue_recovery.db";

    this.anthropicApiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();

    this.frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    this.allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

    this.publicDemoMode = parseBool(process.env.PUBLIC_DEMO_MODE, true);
    this.demoResetIntervalMinutes = parseInt(process.env.DEMO_RESET_INTERVAL_MINUTES || "60", 10) || 60;

    this.port = parseInt(process.env.PORT || "8002", 10) || 8002;
  }
}
