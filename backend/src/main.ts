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
// boots.
//
// Two things deliberately avoid relying on `process.cwd()` or a relative
// DATABASE_URL, since Hostinger's runtime working directory and which
// source files survive deployment (it ships dist/ + node_modules/, but not
// the original prisma/ source folder) turned out not to match local dev:
//   1. The schema is read from a copy placed at dist/prisma/schema.prisma
//      (see the "postbuild" script) and located via `__dirname`, which is
//      always the compiled main.js's own folder regardless of cwd.
//   2. DATABASE_URL is overridden to an absolute path before anything
//      touches the database, so both this CLI call and the Nest app's own
//      PrismaClient definitely open the exact same file.
//
// Calls Prisma's CLI JS entry point directly with `node` rather than
// `npx prisma` (which can fetch a different major version instead of using
// the one already installed) or the .bin wrapper (needs a shell on Windows).
function ensureDatabaseSchema() {
  const projectRoot = path.join(__dirname, ".."); // dist/ -> project root
  const schemaPath = path.join(__dirname, "prisma", "schema.prisma");
  const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
  const dbPath = path.join(projectRoot, "revenue_recovery.db");

  process.env.DATABASE_URL = `file:${dbPath}`;

  if (!fs.existsSync(schemaPath)) {
    // eslint-disable-next-line no-console
    console.error(`Prisma schema not found at ${schemaPath} — skipping schema push.`);
    return;
  }
  if (!fs.existsSync(prismaCli)) {
    // eslint-disable-next-line no-console
    console.error(`Prisma CLI not found at ${prismaCli} — skipping schema push.`);
    return;
  }

  try {
    execFileSync(
      process.execPath,
      [prismaCli, "db", "push", "--schema", schemaPath, "--accept-data-loss", "--skip-generate"],
      { stdio: "inherit", cwd: projectRoot, env: process.env },
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
