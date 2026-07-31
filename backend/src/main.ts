import "dotenv/config";
import "reflect-metadata";
import * as path from "path";
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";

// Some hosts (e.g. Hostinger's Node app runner) invoke `node dist/main.js`
// directly, bypassing npm's prestart lifecycle hooks — so schema creation
// must not depend on npm running it. Do it here instead, before the Nest
// app (and anything that queries the DB in onModuleInit, like seeding)
// boots.
//
// This deliberately avoids `prisma db push` (the CLI/schema-engine path) —
// on Hostinger the schema-engine binary panics at runtime (likely a
// build-container vs. runtime-container OpenSSL mismatch) even after fixing
// its execute permission. Instead, the exact CREATE TABLE/INDEX statements
// Prisma itself generates for this schema (captured once via a local
// `db push` and pasted in below) are executed directly through the query
// engine, which — unlike the schema-engine — now has multi-platform
// binaries bundled via `binaryTargets` in schema.prisma and is confirmed
// working.
const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "company" TEXT,
    "country" TEXT,
    "address" TEXT,
    "risk_level" TEXT NOT NULL DEFAULT 'low',
    "total_outstanding" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "invoices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoice_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "amount_paid" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issue_date" DATETIME NOT NULL,
    "due_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "days_overdue" INTEGER NOT NULL DEFAULT 0,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" DATETIME,
    "escalated_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "payment_plans" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "total_amount" REAL NOT NULL,
    "installments" INTEGER NOT NULL,
    "installment_amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" DATETIME NOT NULL,
    "next_due_date" DATETIME NOT NULL,
    "amount_paid" REAL NOT NULL DEFAULT 0,
    "installments_paid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_plans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_plans_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "reminders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "reminder_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "sent_at" DATETIME,
    "response_received" BOOLEAN NOT NULL DEFAULT false,
    "response_text" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_key" ON "customers"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number")`,
];

// Prisma's native engine binaries also lose their executable bit somewhere
// in Hostinger's deploy pipeline (build and runtime appear to be separate
// filesystems/containers, and whatever copies artifacts between them
// doesn't preserve permissions) — restore it on every binary-looking file
// before the query engine (used below, and by the app's own PrismaService)
// tries to load one.
function restoreEngineExecutePermissions(projectRoot: string) {
  const dirs = [
    path.join(projectRoot, "node_modules", "@prisma"),
    path.join(projectRoot, "node_modules", ".prisma"),
  ];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/engine/i.test(entry.name)) {
        try {
          fs.chmodSync(full, 0o755);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`Could not chmod ${full}:`, err);
        }
      }
    }
  };
  dirs.forEach(walk);
}

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[schema-init ${new Date().toISOString()}] ${msg}`);
}

async function ensureDatabaseSchemaInner() {
  const projectRoot = path.join(__dirname, ".."); // dist/ -> project root
  const dbPath = path.join(projectRoot, "revenue_recovery.db");

  process.env.DATABASE_URL = `file:${dbPath}`;
  log(`DATABASE_URL set to file:${dbPath}`);

  log("restoreEngineExecutePermissions: start");
  restoreEngineExecutePermissions(projectRoot);
  log("restoreEngineExecutePermissions: done");

  log("new PrismaClient(): start");
  const prisma = new PrismaClient();
  log("new PrismaClient(): done");

  try {
    for (let i = 0; i < SCHEMA_SQL.length; i++) {
      log(`executeRawUnsafe[${i}]: start`);
      await prisma.$executeRawUnsafe(SCHEMA_SQL[i]);
      log(`executeRawUnsafe[${i}]: done`);
    }
    log("Database schema ensured (customers, invoices, payment_plans, reminders).");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to create database schema:", err);
  } finally {
    log("$disconnect(): start");
    await prisma.$disconnect();
    log("$disconnect(): done");
  }
}

// Whatever is actually hanging here (still being diagnosed on Hostinger — see
// the step-by-step "[schema-init]" log lines above/below this call), the
// server must come up regardless: race the real setup against a hard
// timeout so `app.listen()` always gets called within Hostinger's own
// startup window, rather than the whole process going dark.
async function ensureDatabaseSchema() {
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      log("TIMEOUT after 8s — proceeding to start the server anyway.");
      resolve();
    }, 8000);
  });
  await Promise.race([ensureDatabaseSchemaInner(), timeout]);
}

async function bootstrap() {
  await ensureDatabaseSchema();

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
