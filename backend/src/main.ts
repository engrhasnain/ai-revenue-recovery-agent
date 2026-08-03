import "dotenv/config";
import "reflect-metadata";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
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
// This deliberately avoids `prisma db push` and Prisma's own native query
// engine entirely — on Hostinger the schema-engine binary panics at
// startup, and even after routing around it, the native query engine hangs
// indefinitely on its very first query (confirmed via step-by-step startup
// logging). Both are replaced by the libSQL driver adapter (see
// prisma.service.ts for the same swap on the app's normal query path, and
// for why libSQL specifically rather than better-sqlite3) — the exact
// CREATE TABLE/INDEX statements Prisma itself generates for this schema
// (captured once via a local `db push`) are executed directly through it.
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

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[schema-init ${new Date().toISOString()}] ${msg}`);
}

async function ensureDatabaseSchemaInner() {
  // A real DATABASE_URL (e.g. a remote "libsql://..." Turso database, needed
  // on hosts like Vercel with no persistent local disk shared across
  // instances) always wins; only fall back to a local file when unset, for
  // plain local development.
  const projectRoot = path.join(__dirname, ".."); // dist/ -> project root
  const dbPath = path.join(projectRoot, "revenue_recovery.db");
  const url = process.env.DATABASE_URL || `file:${dbPath}`;
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  process.env.DATABASE_URL = url;
  log(`DATABASE_URL set to ${url}`);

  log("new PrismaClient() with libSQL adapter: start");
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) });
  log("new PrismaClient() with libSQL adapter: done");

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

// Belt-and-suspenders: the better-sqlite3 adapter fixed the actual hang, but
// keep a hard timeout so `app.listen()` always gets called within
// Hostinger's own startup window no matter what — the timer is cancelled
// as soon as the real work finishes, so it won't fire (or log) on the
// normal, fast path.
async function ensureDatabaseSchema() {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      log("TIMEOUT after 8s — proceeding to start the server anyway.");
      resolve();
    }, 8000);
  });
  await Promise.race([ensureDatabaseSchemaInner(), timeout]);
  clearTimeout(timer!);
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
