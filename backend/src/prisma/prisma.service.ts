import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    // libSQL driver adapter — see schema.prisma for why (Prisma's native
    // query engine hangs on Hostinger; better-sqlite3 can't compile there
    // either). Unlike better-sqlite3, libSQL's url uses the "file:" scheme
    // directly, matching config.databaseUrl as-is. On Vercel, config.databaseUrl
    // instead holds a remote "libsql://..." URL (e.g. Turso) since there's no
    // persistent local disk shared across instances — the same adapter
    // handles both, given the matching auth token.
    super({
      adapter: new PrismaLibSQL({
        url: config.databaseUrl,
        authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      }),
      log: config.debug ? ["query", "warn", "error"] : ["warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to database");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
