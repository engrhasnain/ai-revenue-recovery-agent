import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Invoice, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RecoveryService } from "../recovery/recovery.service";
import { AiService } from "../ai/ai.service";
import { InvoiceStatus, ReminderChannel } from "../common/enums";
import { toDateOnly } from "../common/date.util";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { ListInvoicesQueryDto } from "./dto/list-invoices.query.dto";

function mapInvoice(invoice: Invoice) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    customer_id: invoice.customer_id,
    amount: invoice.amount,
    currency: invoice.currency,
    issue_date: toDateOnly(invoice.issue_date),
    due_date: toDateOnly(invoice.due_date),
    description: invoice.description,
    notes: invoice.notes,
    amount_paid: invoice.amount_paid,
    status: invoice.status,
    days_overdue: invoice.days_overdue,
    reminder_count: invoice.reminder_count,
    last_reminder_at: invoice.last_reminder_at,
    escalated_at: invoice.escalated_at,
    created_at: invoice.created_at,
    updated_at: invoice.updated_at,
    amount_due: invoice.amount - invoice.amount_paid,
  };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: RecoveryService,
    private readonly ai: AiService,
  ) {}

  async list(query: ListInvoicesQueryDto) {
    const where: Prisma.InvoiceWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.customer_id) where.customer_id = query.customer_id;

    const invoices = await this.prisma.invoice.findMany({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { due_date: "asc" },
    });
    return invoices.map(mapInvoice);
  }

  async create(payload: CreateInvoiceDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: payload.customer_id } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const existing = await this.prisma.invoice.findUnique({ where: { invoice_number: payload.invoice_number } });
    if (existing) {
      throw new ConflictException("Invoice number already exists");
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        invoice_number: payload.invoice_number,
        customer_id: payload.customer_id,
        amount: payload.amount,
        currency: payload.currency ?? "USD",
        issue_date: new Date(payload.issue_date),
        due_date: new Date(payload.due_date),
        description: payload.description,
        notes: payload.notes,
      },
    });

    await this.recovery.refreshCustomerOutstanding(customer.id);

    return mapInvoice(invoice);
  }

  async get(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return mapInvoice(invoice);
  }

  async update(invoiceId: number, payload: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const data: Prisma.InvoiceUpdateInput = {};
    if (payload.amount_paid !== undefined) data.amount_paid = payload.amount_paid;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.due_date !== undefined) data.due_date = new Date(payload.due_date);
    if (payload.notes !== undefined) data.notes = payload.notes;

    const nextAmountPaid = payload.amount_paid ?? invoice.amount_paid;
    if (nextAmountPaid >= invoice.amount) {
      data.status = InvoiceStatus.PAID;
    }

    const updated = await this.prisma.invoice.update({ where: { id: invoiceId }, data });
    await this.recovery.refreshCustomerOutstanding(invoice.customer_id);

    return mapInvoice(updated);
  }

  async remove(invoiceId: number): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    await this.prisma.invoice.delete({ where: { id: invoiceId } });
    await this.recovery.refreshCustomerOutstanding(invoice.customer_id);
  }

  async nextAction(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const lastReminder = await this.prisma.reminder.findFirst({
      where: { invoice_id: invoiceId },
      orderBy: { created_at: "desc" },
    });

    let lastResponseIntent: string | null = null;
    if (lastReminder?.response_received && lastReminder.response_text) {
      lastResponseIntent = lastReminder.response_text.slice(0, 200);
    }

    return this.ai.suggestNextAction({
      daysOverdue: invoice.days_overdue,
      reminderCount: invoice.reminder_count,
      lastChannel: lastReminder ? (lastReminder.channel as ReminderChannel) : null,
      lastResponseIntent,
      riskLevel: invoice.customer?.risk_level ?? "medium",
      totalOutstanding: invoice.amount - invoice.amount_paid,
    });
  }

  async markPaid(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { amount_paid: invoice.amount, status: InvoiceStatus.PAID },
    });
    await this.recovery.refreshCustomerOutstanding(invoice.customer_id);

    return { ...mapInvoice(updated), amount_due: 0.0 };
  }

  async bulkExtract(files: Express.Multer.File[]) {
    const results = [];
    for (const file of files) {
      const extracted = await this.ai.extractInvoiceFromDocument(
        file.buffer,
        file.mimetype || "application/octet-stream",
        file.originalname || "document",
      );
      results.push({ ...extracted, filename: file.originalname || "document" });
    }
    return results;
  }
}
