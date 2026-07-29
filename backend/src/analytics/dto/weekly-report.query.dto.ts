import { IsIn, IsOptional } from "class-validator";

export class WeeklyReportQueryDto {
  @IsOptional()
  @IsIn(["weekly", "monthly", "quarterly", "yearly"])
  period: string = "weekly";
}
