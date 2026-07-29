import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { resetDatabase, seedDatabase } from "./seed-runner";

const RESET_INTERVAL_NAME = "public-demo-reset";

/**
 * Mirrors the lifespan logic in backend-fastapi-archive/src/app/main.py:
 *  - first-run convenience seed if the demo DB is empty and PUBLIC_DEMO_MODE
 *    is on (so a fresh deploy isn't blank before anyone runs the seed script)
 *  - a periodic reset loop (DEMO_RESET_INTERVAL_MINUTES) that wipes and
 *    reseeds the DB back to its originally-seeded state
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.publicDemoMode) {
      return;
    }

    try {
      const count = await this.prisma.customer.count();
      if (count === 0) {
        this.logger.log("Public demo DB is empty — seeding initial demo data");
        await seedDatabase(this.prisma);
      }
    } catch (err) {
      this.logger.error("Initial public demo seed check failed", err instanceof Error ? err.stack : String(err));
    }

    const intervalMs = Math.max(this.config.demoResetIntervalMinutes, 1) * 60 * 1000;
    const interval = setInterval(() => {
      void this.runScheduledReset();
    }, intervalMs);
    // Don't let the interval keep the process alive on its own during shutdown.
    interval.unref?.();
    this.scheduler.addInterval(RESET_INTERVAL_NAME, interval);
  }

  private async runScheduledReset(): Promise<void> {
    try {
      await resetDatabase(this.prisma);
      this.logger.log("Public demo database reset to its originally-seeded state.");
    } catch (err) {
      // A failed reset must never take down the app for public visitors.
      this.logger.error("Scheduled demo database reset failed", err instanceof Error ? err.stack : String(err));
    }
  }
}
