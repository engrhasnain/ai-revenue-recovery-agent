import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AiModule } from "./ai/ai.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RecoveryModule } from "./recovery/recovery.module";
import { SeedModule } from "./seed/seed.module";
import { CustomersModule } from "./customers/customers.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { RemindersModule } from "./reminders/reminders.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { HealthController } from "./health/health.controller";
import { DetailExceptionFilter } from "./common/filters/detail-exception.filter";
import { RateLimitGuard } from "./common/guards/rate-limit.guard";
import { ONE_HOUR_MS } from "./common/throttle.constants";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AiModule,
    NotificationsModule,
    RecoveryModule,
    SeedModule,
    ScheduleModule.forRoot(),
    // Generous default (120/hour) for plain read endpoints and everything
    // else; AI-calling endpoints override this per-route with @Throttle(AI_THROTTLE)
    // (20/hour) — mirrors backend-fastapi-archive/src/app/utils/rate_limit.py.
    ThrottlerModule.forRoot([{ name: "default", ttl: ONE_HOUR_MS, limit: 120 }]),
    CustomersModule,
    InvoicesModule,
    RemindersModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: DetailExceptionFilter },
  ],
})
export class AppModule {}
