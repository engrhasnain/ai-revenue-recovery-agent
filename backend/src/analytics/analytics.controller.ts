import { Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AI_THROTTLE } from "../common/throttle.constants";
import { AnalyticsService } from "./analytics.service";
import { WeeklyReportQueryDto } from "./dto/weekly-report.query.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  dashboard() {
    return this.analyticsService.dashboardSummary();
  }

  @Get("overdue-aging")
  overdueAging() {
    return this.analyticsService.overdueAging();
  }

  @Get("cash-flow-prediction")
  @Throttle(AI_THROTTLE)
  cashFlowPrediction() {
    return this.analyticsService.cashFlowPrediction();
  }

  @Get("weekly-report")
  @Throttle(AI_THROTTLE)
  weeklyReport(@Query() query: WeeklyReportQueryDto) {
    return this.analyticsService.weeklyReport(query.period);
  }
}
