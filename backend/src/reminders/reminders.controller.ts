import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AI_THROTTLE } from "../common/throttle.constants";
import { RemindersService } from "./reminders.service";
import { ListRemindersQueryDto } from "./dto/list-reminders.query.dto";
import { GenerateReminderDto } from "./dto/generate-reminder.dto";
import { LogResponseDto } from "./dto/log-response.dto";

@Controller("reminders")
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  list(@Query() query: ListRemindersQueryDto) {
    return this.remindersService.list(query);
  }

  @Post("generate-and-send")
  @HttpCode(201)
  @Throttle(AI_THROTTLE)
  generateAndSend(@Body() payload: GenerateReminderDto) {
    return this.remindersService.generateAndSend(payload);
  }

  @Get(":reminderId")
  get(@Param("reminderId", ParseIntPipe) reminderId: number) {
    return this.remindersService.get(reminderId);
  }

  @Post(":reminderId/resend")
  resend(@Param("reminderId", ParseIntPipe) reminderId: number) {
    return this.remindersService.resend(reminderId);
  }

  // Response text arrives in the request body (LogResponseDto), never as a
  // query parameter — see dto/log-response.dto.ts for why that matters.
  @Post(":reminderId/log-response")
  @Throttle(AI_THROTTLE)
  logResponse(@Param("reminderId", ParseIntPipe) reminderId: number, @Body() payload: LogResponseDto) {
    return this.remindersService.logResponse(reminderId, payload);
  }

  @Post("escalate/:invoiceId")
  @Throttle(AI_THROTTLE)
  escalate(@Param("invoiceId", ParseIntPipe) invoiceId: number) {
    return this.remindersService.escalate(invoiceId);
  }
}
