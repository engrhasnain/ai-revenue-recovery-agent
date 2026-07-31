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
    // directly, matching config.databaseUrl as-is.
    super({
      adapter: new PrismaLibSQL({ url: config.databaseUrl }),
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
