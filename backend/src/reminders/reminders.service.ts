import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RecoveryService } from "../recovery/recovery.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AiService } from "../ai/ai.service";
import { ListRemindersQueryDto } from "./dto/list-reminders.query.dto";
import { GenerateReminderDto } from "./dto/generate-reminder.dto";
import { LogResponseDto } from "./dto/log-response.dto";

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: RecoveryService,
    private readonly notifications: NotificationsService,
    private readonly ai: AiService,
  ) {}

  async list(query: ListRemindersQueryDto) {
    const where: Prisma.ReminderWhereInput = {};
    if (query.customer_id) where.customer_id = query.customer_id;
    if (query.invoice_id) where.invoice_id = query.invoice_id;
    if (query.channel) where.channel = query.channel;

    return this.prisma.reminder.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: query.skip,
      take: query.limit,
    });
  }

  async generateAndSend(payload: GenerateReminderDto) {
    try {
      return await this.recovery.generateAndSendReminder({
        invoiceId: payload.invoice_id,
        channel: payload.channel,
        reminderType: payload.reminder_type,
        customInstructions: payload.custom_instructions,
      });
    } catch (err) {
      throw new NotFoundException(err instanceof Error ? err.message : String(err));
    }
  }

  async get(reminderId: number) {
    const reminder = await this.prisma.reminder.findUnique({ where: { id: reminderId } });
    if (!reminder) {
      throw new NotFoundException("Reminder not found");
    }
    return reminder;
  }

  async resend(reminderId: number) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { customer: true },
    });
    if (!reminder) {
      throw new NotFoundException("Reminder not found");
    }

    const customer = reminder.customer;
    await this.notifications.dispatchReminder({
      reminder,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerWhatsapp: customer.whatsapp,
    });

    return this.prisma.reminder.findUniqueOrThrow({ where: { id: reminderId } });
  }

  async logResponse(reminderId: number, payload: LogResponseDto) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { invoice: true },
    });
    if (!reminder) {
      throw new NotFoundException("Reminder not found");
    }

    await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { response_received: true, response_text: payload.response_text },
    });

    const invoice = reminder.invoice;
    const analysis = await this.ai.analyzeCustomerResponse({
      responseText: payload.response_text,
      invoiceNumber: invoice.invoice_number,
      amountDue: invoice.amount - invoice.amount_paid,
    });

    return { reminder_id: reminderId, analysis };
  }

  async escalate(invoiceId: number) {
    try {
      const invoice = await this.recovery.escalateInvoice(invoiceId);
      return { message: `Invoice ${invoice.invoice_number} escalated successfully`, invoice_id: invoiceId };
    } catch (err) {
      throw new NotFoundException(err instanceof Error ? err.message : String(err));
    }
  }
}
