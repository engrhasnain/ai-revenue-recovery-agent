import { Injectable, Logger } from "@nestjs/common";
import { Customer, Invoice } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { NotificationsService } from "../notifications/notifications.service";
import { InvoiceStatus, ReminderChannel, ReminderType, RiskLevel } from "../common/enums";

/**
 * Full port of backend-fastapi-archive/src/app/services/recovery_service.py.
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Marks all past-due invoices as overdue and updates days_overdue. Returns count updated. */
  async refreshOverdueStatus(): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        due_date: { lt: today },
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
      },
    });

    for (const invoice of invoices) {
      const daysOverdue = Math.floor((today.getTime() - invoice.due_date.getTime()) / (24 * 60 * 60 * 1000));
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { days_overdue: daysOverdue, status: InvoiceStatus.OVERDUE },
      });
    }

    return invoices.length;
  }

  /** Re-classifies a customer's risk level using AI based on their invoice state. */
  async refreshCustomerRisk(customer: Customer & { invoices: Invoice[] }): Promise<RiskLevel> {
    const overdueInvoices = customer.invoices.filter((inv) => inv.status === InvoiceStatus.OVERDUE);
    const maxDays = overdueInvoices.length ? Math.max(...overdueInvoices.map((inv) => inv.days_overdue)) : 0;

    const risk = await this.ai.classifyCustomerRisk({
      customerName: customer.name,
      daysOverdue: maxDays,
      totalOutstanding: customer.total_outstanding,
      reminderCount: overdueInvoices.reduce((sum, inv) => sum + inv.reminder_count, 0),
      paymentHistoryNotes: customer.notes || "",
    });

    await this.prisma.customer.update({ where: { id: customer.id }, data: { risk_level: risk } });
    return risk;
  }

  /** Recalculates and persists total_outstanding for a customer. */
  async refreshCustomerOutstanding(customerId: number): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        customer_id: customerId,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] },
      },
    });
    const total = invoices.reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0);
    await this.prisma.customer.update({ where: { id: customerId }, data: { total_outstanding: total } });
    return total;
  }

  async generateAndSendReminder(params: {
    invoiceId: number;
    channel: ReminderChannel;
    reminderType: ReminderType;
    customInstructions?: string | null;
  }) {
    const { invoiceId, channel, reminderType, customInstructions } = params;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    const customer = invoice.customer;

    const content = await this.ai.generateReminderMessage({
      customerName: customer.name,
      company: customer.company,
      invoiceNumber: invoice.invoice_number,
      amountDue: invoice.amount - invoice.amount_paid,
      currency: invoice.currency,
      daysOverdue: invoice.days_overdue,
      dueDate: invoice.due_date.toISOString().slice(0, 10),
      channel,
      reminderType,
      country: customer.country || "",
      customInstructions,
    });

    const reminder = await this.prisma.reminder.create({
      data: {
        customer_id: customer.id,
        invoice_id: invoice.id,
        channel,
        reminder_type: reminderType,
        subject: content.subject,
        message: content.message,
        ai_generated: true,
      },
    });

    await this.notifications.dispatchReminder({
      reminder,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerWhatsapp: customer.whatsapp,
    });

    const invoiceUpdate: { reminder_count: number; last_reminder_at: Date; status?: InvoiceStatus; escalated_at?: Date } = {
      reminder_count: invoice.reminder_count + 1,
      last_reminder_at: new Date(),
    };
    if (reminderType === ReminderType.ESCALATION) {
      invoiceUpdate.status = InvoiceStatus.ESCALATED;
      invoiceUpdate.escalated_at = new Date();
    }
    await this.prisma.invoice.update({ where: { id: invoice.id }, data: invoiceUpdate });

    // Return the reminder with its up-to-date (post-dispatch) status.
    return this.prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } });
  }

  async escalateInvoice(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true } });
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.ESCALATED, escalated_at: new Date() },
    });

    await this.generateAndSendReminder({
      invoiceId,
      channel: ReminderChannel.EMAIL,
      reminderType: ReminderType.ESCALATION,
    });

    return this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  }
}
