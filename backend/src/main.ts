import "dotenv/config";
import "reflect-metadata";
import { execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";

// Some hosts (e.g. Hostinger's Node app runner) invoke `node dist/main.js`
// directly, bypassing npm's prestart lifecycle hooks — so the schema-push
// step must not depend on npm running it. Do it here instead, before the
// Nest app (and anything that queries the DB in onModuleInit, like seeding)
// boots. Calls Prisma's CLI JS entry point directly with `node` rather than
// `npx prisma` (which can fetch a different major version instead of using
// the one already installed) or the .bin wrapper (needs a shell on Windows).
function ensureDatabaseSchema() {
  const projectRoot = process.cwd();
  const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

  if (!fs.existsSync(prismaCli)) {
    // eslint-disable-next-line no-console
    console.error(`Prisma CLI not found at ${prismaCli} — skipping schema push.`);
    return;
  }

  try {
    execFileSync(
      process.execPath,
      [prismaCli, "db", "push", "--accept-data-loss", "--skip-generate"],
      { stdio: "inherit", cwd: projectRoot },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Prisma db push failed during startup:", err);
  }
}

async function bootstrap() {
  ensureDatabaseSchema();

  const app = await NestFactory.create(AppModule);

  const config = app.get(AppConfigService);

  // "/" and "/health" stay unprefixed — every other controller sits under
  // "/api/v1", matching backend-fastapi-archive/src/app/main.py's
  // `app.include_router(..., prefix="/api/v1")` calls.
  app.setGlobalPrefix("api/v1", { exclude: ["/", "health"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // FastAPI/pydantic uses 422 for request validation errors — matched
      // here for parity even though the frontend only reads `.detail`.
      errorHttpStatusCode: 422,
    }),
  );

  // No wildcard origin, and credentials are only enabled when the origin is
  // a concrete value — mirrors the CORS hardening in main.py.
  app.enableCors({
    origin: config.allowedOrigin,
    credentials: config.allowedOrigin !== "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
  });

  await app.listen(config.port);
  Logger.log(`${config.appName} listening on port ${config.port} (public demo mode: ${config.publicDemoMode})`, "Bootstrap");
}

bootstrap().catch((err) => {
  // Fail fast and loudly — e.g. a missing/placeholder SECRET_KEY throws here
  // during AppConfigService construction, matching the Python version's
  // startup-time pydantic validation error.
  // eslint-disable-next-line no-console
  console.error("Fatal error during application bootstrap:", err);
  process.exit(1);
});
