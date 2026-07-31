import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    // better-sqlite3 (unlike Prisma's own datasource url) takes a plain
    // file path, not a "file:" URL scheme — strip the prefix if present.
    const filePath = config.databaseUrl.startsWith("file:")
      ? config.databaseUrl.slice("file:".length)
      : config.databaseUrl;
    super({
      adapter: new PrismaBetterSQLite3({ url: filePath }),
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
