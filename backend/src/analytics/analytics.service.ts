import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecoveryService } from "../recovery/recovery.service";
import { AiService } from "../ai/ai.service";
import { InvoiceStatus, ReminderStatus, RiskLevel } from "../common/enums";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: RecoveryService,
    private readonly ai: AiService,
  ) {}

  async dashboardSummary() {
    const updated = await this.recovery.refreshOverdueStatus();

    const invoiceRows = await this.prisma.invoice.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { amount: true, amount_paid: true },
    });

    const totalInvoices = invoiceRows.reduce((s, r) => s + r._count.id, 0);
    const totalBilled = invoiceRows.reduce((s, r) => s + (r._sum.amount || 0), 0);
    const totalCollected = invoiceRows.reduce((s, r) => s + (r._sum.amount_paid || 0), 0);
    const totalOutstanding = totalBilled - totalCollected;

    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const r of invoiceRows) {
      byStatus[r.status] = { count: r._count.id, amount: r._sum.amount || 0 };
    }

    const riskRows = await this.prisma.customer.groupBy({ by: ["risk_level"], _count: { id: true } });
    const riskDist: Record<string, number> = {};
    for (const r of riskRows) riskDist[r.risk_level] = r._count.id;

    const reminderRows = await this.prisma.reminder.groupBy({ by: ["status"], _count: { id: true } });
    const reminderStats: Record<string, number> = {};
    for (const r of reminderRows) reminderStats[r.status] = r._count.id;

    const topOverdue = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.OVERDUE },
      orderBy: { days_overdue: "desc" },
      take: 5,
    });

    return {
      summary: {
        total_invoices: totalInvoices,
        total_billed: round2(totalBilled),
        total_collected: round2(totalCollected),
        total_outstanding: round2(totalOutstanding),
        collection_rate: totalBilled ? round1((totalCollected / totalBilled) * 100) : 0,
        overdue_refreshed_count: updated,
      },
      by_status: byStatus,
      risk_distribution: {
        low: riskDist[RiskLevel.LOW] || 0,
        medium: riskDist[RiskLevel.MEDIUM] || 0,
        high: riskDist[RiskLevel.HIGH] || 0,
      },
      reminders: {
        sent: reminderStats[ReminderStatus.SENT] || 0,
        delivered: reminderStats[ReminderStatus.DELIVERED] || 0,
        failed: reminderStats[ReminderStatus.FAILED] || 0,
      },
      top_overdue: topOverdue.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount_due: round2(inv.amount - inv.amount_paid),
        days_overdue: inv.days_overdue,
        customer_id: inv.customer_id,
      })),
    };
  }

  async overdueAging() {
    const invoices = await this.prisma.invoice.findMany({ where: { status: InvoiceStatus.OVERDUE } });

    const buckets: Record<string, { invoice_number: string; amount_due: number; days_overdue: number }[]> = {
      "0_30": [],
      "31_60": [],
      "61_90": [],
      "90_plus": [],
    };

    for (const inv of invoices) {
      const amt = round2(inv.amount - inv.amount_paid);
      const entry = { invoice_number: inv.invoice_number, amount_due: amt, days_overdue: inv.days_overdue };
      if (inv.days_overdue <= 30) buckets["0_30"].push(entry);
      else if (inv.days_overdue <= 60) buckets["31_60"].push(entry);
      else if (inv.days_overdue <= 90) buckets["61_90"].push(entry);
      else buckets["90_plus"].push(entry);
    }

    const result: Record<string, { invoices: unknown[]; total: number; count: number }> = {};
    for (const [bucket, items] of Object.entries(buckets)) {
      result[bucket] = {
        invoices: items,
        total: round2(items.reduce((s, i) => s + i.amount_due, 0)),
        count: items.length,
      };
    }
    return result;
  }

  async cashFlowPrediction() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.ESCALATED] } },
      include: { customer: true },
    });

    const invoicesData = invoices.map((inv) => ({
      invoice_number: inv.invoice_number,
      amount_due: round2(inv.amount - inv.amount_paid),
      days_overdue: inv.days_overdue,
      risk_level: inv.customer?.risk_level ?? "medium",
    }));

    return this.ai.predictCashFlow(invoicesData);
  }

  async weeklyReport(period: string) {
    const invoiceRows = await this.prisma.invoice.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { amount: true, amount_paid: true },
    });

    const totalCollected = invoiceRows.reduce((s, r) => s + (r._sum.amount_paid || 0), 0);
    const totalBilled = invoiceRows.reduce((s, r) => s + (r._sum.amount || 0), 0);
    const overdueCount = invoiceRows.find((r) => r.status === InvoiceStatus.OVERDUE)?._count.id ?? 0;
    const escalatedCount = invoiceRows.find((r) => r.status === InvoiceStatus.ESCALATED)?._count.id ?? 0;

    const riskRows = await this.prisma.customer.groupBy({ by: ["risk_level"], _count: { id: true } });
    const highRiskCount = riskRows.find((r) => r.risk_level === RiskLevel.HIGH)?._count.id ?? 0;

    const remindersSent = await this.prisma.reminder.count({
      where: { status: { in: [ReminderStatus.SENT, ReminderStatus.DELIVERED] } },
    });

    const totalClients = await this.prisma.customer.count();

    const stats = {
      period: new Date().toISOString().slice(0, 10),
      period_type: period,
      total_outstanding: round2(totalBilled - totalCollected),
      total_collected: round2(totalCollected),
      collection_rate: totalBilled ? round1((totalCollected / totalBilled) * 100) : 0,
      overdue_count: overdueCount,
      escalated_count: escalatedCount,
      high_risk_count: highRiskCount,
      reminders_sent: remindersSent,
      total_clients: totalClients,
    };

    const reportText = await this.ai.generateWeeklyReport(stats, period);
    return { report: reportText, stats, generated_at: new Date().toISOString().slice(0, 10), period };
  }
}
