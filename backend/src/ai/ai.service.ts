import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { AppConfigService } from "../config/app-config.service";
import { ReminderChannel, ReminderType, RiskLevel } from "../common/enums";
import { detectLanguage, getTemplates, LANG_MAP } from "./reminder-templates";
import { fmt, fmtMoney } from "./format.util";
import { md5Seed, SeededRandom } from "./seeded-random.util";

const MODEL = "claude-haiku-4-5-20251001";
const VISION_MODEL = "claude-opus-4-8";

export interface NextActionResult {
  action: string;
  channel: string | null;
  reminder_type: string | null;
  reason: string;
  urgency: "low" | "medium" | "high";
  label: string;
}

export interface ExtractedInvoiceResult {
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  description: string;
  confidence: "high" | "medium" | "low";
  error: string | null;
}

/**
 * Full port of backend-fastapi-archive/src/app/services/ai_service.py.
 *
 * DEMO_MODE (no ANTHROPIC_API_KEY) uses the exact same deterministic/
 * heuristic fallbacks as the Python version; live-mode Claude calls use the
 * same prompts/models. Any live-call failure — malformed response, bad
 * model id, API error — falls back to the demo-mode logic rather than ever
 * surfacing a crash to a public visitor (see extractInvoiceFromDocument).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly demoMode: boolean;
  private readonly client: Anthropic | null;

  constructor(private readonly config: AppConfigService) {
    this.demoMode = !this.config.anthropicApiKey;
    this.client = this.demoMode ? null : new Anthropic({ apiKey: this.config.anthropicApiKey });
  }

  private demoRisk(daysOverdue: number, totalOutstanding: number, reminderCount: number): RiskLevel {
    let score = 0;
    if (daysOverdue > 60) score += 3;
    else if (daysOverdue > 30) score += 2;
    else if (daysOverdue > 0) score += 1;

    if (totalOutstanding > 20000) score += 2;
    else if (totalOutstanding > 5000) score += 1;

    if (reminderCount > 3) score += 2;
    else if (reminderCount > 1) score += 1;

    if (score >= 5) return RiskLevel.HIGH;
    if (score >= 2) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  async classifyCustomerRisk(params: {
    customerName: string;
    daysOverdue: number;
    totalOutstanding: number;
    reminderCount: number;
    paymentHistoryNotes?: string;
  }): Promise<RiskLevel> {
    const { customerName, daysOverdue, totalOutstanding, reminderCount, paymentHistoryNotes = "" } = params;

    if (this.demoMode) {
      return this.demoRisk(daysOverdue, totalOutstanding, reminderCount);
    }

    const prompt = `You are a financial risk analyst. Classify this customer's payment risk.

Customer: ${customerName}
Days overdue: ${daysOverdue}
Total outstanding: $${totalOutstanding.toFixed(2)}
Reminders sent: ${reminderCount}
Notes: ${paymentHistoryNotes || "None"}

Respond with exactly one word: low, medium, or high`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: "user", content: prompt }],
      });
      const response = this.textOf(message).trim().toLowerCase();
      if (response.includes("high")) return RiskLevel.HIGH;
      if (response.includes("medium")) return RiskLevel.MEDIUM;
      return RiskLevel.LOW;
    } catch (err) {
      this.logger.warn(`Live risk classification failed, falling back to demo heuristic: ${err}`);
      return this.demoRisk(daysOverdue, totalOutstanding, reminderCount);
    }
  }

  async generateReminderMessage(params: {
    customerName: string;
    company?: string | null;
    invoiceNumber: string;
    amountDue: number;
    currency: string;
    daysOverdue: number;
    dueDate: string;
    channel: ReminderChannel;
    reminderType: ReminderType;
    country?: string;
    customInstructions?: string | null;
  }): Promise<{ subject: string; message: string; language: string }> {
    const {
      customerName,
      company,
      invoiceNumber,
      amountDue,
      currency,
      daysOverdue,
      dueDate,
      channel,
      reminderType,
      country = "",
      customInstructions,
    } = params;

    const ctx = {
      name: customerName,
      company: company || customerName,
      invoice_number: invoiceNumber,
      amount_due: amountDue,
      currency,
      days_overdue: daysOverdue,
      due_date: dueDate,
    };

    if (this.demoMode) {
      return this.demoReminderMessage(channel, reminderType, country, ctx, invoiceNumber);
    }

    const lang = detectLanguage(country);
    const langNames: Record<string, string> = { de: "German", fr: "French", ja: "Japanese", es: "Spanish", ar: "Arabic", pt: "Portuguese" };
    const langInstruction = lang === "en" ? "" : `Write the message in ${langNames[lang] ?? "English"}.`;
    const toneMap: Partial<Record<ReminderType, string>> = {
      [ReminderType.FIRST_NOTICE]: "friendly and polite",
      [ReminderType.SECOND_NOTICE]: "firm but professional",
      [ReminderType.FINAL_NOTICE]: "urgent and serious",
      [ReminderType.PAYMENT_PLAN_OFFER]: "helpful and solution-focused",
      [ReminderType.ESCALATION]: "formal and stern",
    };
    const channelInstruction: Record<ReminderChannel, string> = {
      [ReminderChannel.EMAIL]: "Write a professional email. Format: SUBJECT: <subject>\n\nBODY:\n<body>",
      [ReminderChannel.WHATSAPP]: "Write a concise WhatsApp message (under 300 chars). No subject.",
      [ReminderChannel.SMS]: "Write a very short SMS (under 160 chars). No subject.",
    };

    const prompt = `Generate a payment reminder for:
Customer: ${customerName}${company ? ` (${company})` : ""}
Invoice: ${invoiceNumber} | Amount Due: ${currency} ${amountDue.toFixed(2)}
Due Date: ${dueDate} | Days Overdue: ${daysOverdue}
Tone: ${toneMap[reminderType] ?? "professional"}
${langInstruction}
${customInstructions ? `Extra: ${customInstructions}` : ""}

${channelInstruction[channel] ?? "Write a professional message."}`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = this.textOf(message).trim();

      if (channel === ReminderChannel.EMAIL && text.includes("SUBJECT:")) {
        const [head, ...rest] = text.split("BODY:");
        const subject = head.replace("SUBJECT:", "").trim();
        const body = rest.length ? rest.join("BODY:").trim() : text;
        return { subject, message: body, language: lang };
      }

      return { subject: `Payment Reminder — Invoice ${invoiceNumber}`, message: text, language: lang };
    } catch (err) {
      this.logger.warn(`Live reminder generation failed, falling back to demo template: ${err}`);
      return this.demoReminderMessage(channel, reminderType, country, ctx, invoiceNumber);
    }
  }

  private demoReminderMessage(
    channel: ReminderChannel,
    reminderType: ReminderType,
    country: string,
    ctx: Record<string, unknown>,
    invoiceNumber: string,
  ): { subject: string; message: string; language: string } {
    const lang = detectLanguage(country);
    const templates = getTemplates(lang);

    if (channel === ReminderChannel.EMAIL) {
      const tmpl = templates.email[reminderType] ?? templates.email[ReminderType.FIRST_NOTICE]!;
      return { subject: fmt(tmpl.subject, ctx), message: fmt(tmpl.message, ctx), language: lang };
    }

    if (channel === ReminderChannel.WHATSAPP) {
      const whatsapp = templates.whatsapp ?? LANG_MAP.en.whatsapp;
      const tmpl = whatsapp[reminderType] ?? whatsapp[ReminderType.FIRST_NOTICE]!;
      return { subject: `WhatsApp — Invoice ${invoiceNumber}`, message: fmt(tmpl, ctx), language: lang };
    }

    const sms = LANG_MAP.en.sms!;
    const tmpl = sms[reminderType] ?? sms[ReminderType.FIRST_NOTICE]!;
    return { subject: `SMS — Invoice ${invoiceNumber}`, message: fmt(tmpl, ctx), language: "en" };
  }

  async analyzeCustomerResponse(params: { responseText: string; invoiceNumber: string; amountDue: number }): Promise<{
    intent: string;
    sentiment: string;
    suggested_action: string;
    urgency: string;
  }> {
    const { responseText, invoiceNumber, amountDue } = params;

    if (this.demoMode) {
      return this.demoAnalyzeResponse(responseText);
    }

    const prompt = `Analyze this customer response to a payment reminder.
Invoice: ${invoiceNumber}, Amount: $${amountDue.toFixed(2)}
Response: "${responseText}"

Reply in JSON: {"intent": "will_pay|dispute|hardship|ignore|request_plan|paid|other", "sentiment": "positive|neutral|negative", "suggested_action": "...", "urgency": "low|medium|high"}`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      return JSON.parse(this.textOf(message).trim());
    } catch {
      return { intent: "other", sentiment: "neutral", suggested_action: "Review manually", urgency: "medium" };
    }
  }

  private demoAnalyzeResponse(responseText: string): { intent: string; sentiment: string; suggested_action: string; urgency: string } {
    const t = responseText.toLowerCase();
    if (["will pay", "paying", "transfer", "payment today", "sending", "paid"].some((w) => t.includes(w))) {
      return { intent: "will_pay", sentiment: "positive", suggested_action: "Schedule a follow-up in 2 days to confirm receipt", urgency: "low" };
    }
    if (["dispute", "wrong", "incorrect", "never received", "already paid", "error"].some((w) => t.includes(w))) {
      return { intent: "dispute", sentiment: "negative", suggested_action: "Escalate to finance team for invoice verification", urgency: "high" };
    }
    if (["struggling", "difficult", "cash flow", "installment", "plan", "partial"].some((w) => t.includes(w))) {
      return { intent: "hardship", sentiment: "neutral", suggested_action: "Offer a structured payment plan", urgency: "medium" };
    }
    return { intent: "other", sentiment: "neutral", suggested_action: "Follow up with a phone call", urgency: "medium" };
  }

  async generatePaymentPlan(params: { customerName: string; totalAmount: number; currency: string; daysOverdue: number }): Promise<{
    installments: number;
    frequency: string;
    installment_amount: number;
    rationale: string;
  }> {
    const { customerName, totalAmount, currency, daysOverdue } = params;

    if (this.demoMode) {
      const installments = totalAmount < 10000 ? 3 : 6;
      return {
        installments,
        frequency: "monthly",
        installment_amount: Math.round((totalAmount / installments) * 100) / 100,
        rationale: `Standard ${installments}-month plan based on outstanding amount`,
      };
    }

    const prompt = `Suggest a payment plan: Customer: ${customerName}, Total: ${currency} ${totalAmount.toFixed(2)}, Days overdue: ${daysOverdue}
JSON: {"installments": 2-6, "frequency": "weekly|biweekly|monthly", "installment_amount": <float>, "rationale": "..."}`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      return JSON.parse(this.textOf(message).trim());
    } catch {
      return {
        installments: 3,
        frequency: "monthly",
        installment_amount: Math.round((totalAmount / 3) * 100) / 100,
        rationale: "Standard 3-month plan",
      };
    }
  }

  async suggestNextAction(params: {
    daysOverdue: number;
    reminderCount: number;
    lastChannel: string | null;
    lastResponseIntent: string | null;
    riskLevel: string;
    totalOutstanding: number;
  }): Promise<NextActionResult> {
    const { daysOverdue, reminderCount, lastChannel, lastResponseIntent, riskLevel, totalOutstanding } = params;

    if (this.demoMode) {
      return this.demoNextAction(daysOverdue, reminderCount, lastChannel, lastResponseIntent, riskLevel, totalOutstanding);
    }

    const prompt = `You are a collections expert. Recommend the single best next action for this overdue invoice.

Days overdue: ${daysOverdue}
Reminders sent: ${reminderCount}
Last channel used: ${lastChannel || "none"}
Customer last response intent: ${lastResponseIntent || "no response"}
Risk level: ${riskLevel}
Outstanding amount: $${totalOutstanding.toFixed(2)}

Reply in JSON: {"action": "send_reminder|escalate|wait|call", "channel": "email|whatsapp|sms|null", "reminder_type": "first_notice|second_notice|final_notice|payment_plan_offer|escalation|null", "reason": "one sentence explanation", "urgency": "low|medium|high", "label": "short button label"}`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      return JSON.parse(this.textOf(message).trim());
    } catch {
      return {
        action: "send_reminder",
        channel: "email",
        reminder_type: "second_notice",
        reason: "Continue standard follow-up cadence.",
        urgency: "medium",
        label: "Send Follow-Up",
      };
    }
  }

  private demoNextAction(
    daysOverdue: number,
    reminderCount: number,
    lastChannel: string | null,
    lastResponseIntent: string | null,
    riskLevel: string,
    totalOutstanding: number,
  ): NextActionResult {
    const intent = (lastResponseIntent || "").toLowerCase();

    if (intent.includes("dispute") || intent.includes("error")) {
      return {
        action: "escalate",
        channel: "email",
        reminder_type: "escalation",
        reason: "Customer has raised a dispute — escalate to finance team for invoice verification.",
        urgency: "high",
        label: "Escalate to Finance",
      };
    }

    if (intent.includes("hardship") || intent.includes("plan")) {
      return {
        action: "send_reminder",
        channel: "email",
        reminder_type: "payment_plan_offer",
        reason: "Customer indicated financial difficulty — offer a structured payment plan immediately.",
        urgency: "medium",
        label: "Offer Payment Plan",
      };
    }

    if (intent.includes("will_pay")) {
      return {
        action: "wait",
        channel: null,
        reminder_type: null,
        reason: "Customer confirmed payment is coming — wait 3 business days before following up.",
        urgency: "low",
        label: "Wait & Confirm",
      };
    }

    if (reminderCount === 0) {
      return {
        action: "send_reminder",
        channel: "email",
        reminder_type: "first_notice",
        reason: "No reminders sent yet. Start with a polite first notice via email.",
        urgency: "low",
        label: "Send First Notice",
      };
    }

    if (reminderCount === 1 && lastChannel === "email") {
      return {
        action: "send_reminder",
        channel: "whatsapp",
        reminder_type: "second_notice",
        reason: "One email sent with no response. Switch to WhatsApp — 2.3× higher open rate for follow-ups.",
        urgency: "medium",
        label: "Follow Up via WhatsApp",
      };
    }

    if (reminderCount === 2 && (riskLevel === "medium" || riskLevel === "high")) {
      return {
        action: "send_reminder",
        channel: "email",
        reminder_type: "final_notice",
        reason: `Two reminders ignored and ${riskLevel} risk profile. Send a firm final notice before escalation.`,
        urgency: "high",
        label: "Send Final Notice",
      };
    }

    if (reminderCount >= 3 && daysOverdue >= 60) {
      return {
        action: "escalate",
        channel: "email",
        reminder_type: "escalation",
        reason: `${reminderCount} reminders sent, ${daysOverdue} days overdue — escalate to collections immediately.`,
        urgency: "high",
        label: "Escalate to Collections",
      };
    }

    if (totalOutstanding > 20000 && daysOverdue > 30) {
      return {
        action: "send_reminder",
        channel: "email",
        reminder_type: "payment_plan_offer",
        reason: `Large outstanding balance (${fmtMoney(totalOutstanding)}) past 30 days — a payment plan offer may break the impasse.`,
        urgency: "medium",
        label: "Offer Payment Plan",
      };
    }

    return {
      action: "send_reminder",
      channel: "email",
      reminder_type: "second_notice",
      reason: `Invoice ${daysOverdue} days overdue with ${reminderCount} reminder(s). Send a follow-up notice.`,
      urgency: "medium",
      label: "Send Follow-Up",
    };
  }

  async predictCashFlow(
    invoicesData: { invoice_number: string; amount_due: number; days_overdue: number; risk_level: string }[],
  ): Promise<{
    predicted_30d: number;
    predicted_60d: number;
    predicted_90d: number;
    total_outstanding: number;
    confidence: string;
    based_on: string;
  }> {
    if (this.demoMode) {
      return this.demoCashFlow(invoicesData);
    }

    const prompt = `Predict payment collection over 30/60/90 days for these overdue invoices:
${JSON.stringify(invoicesData, null, 2)}

Reply JSON: {"predicted_30d": float, "predicted_60d": float, "predicted_90d": float, "total_outstanding": float, "confidence": "low|medium|high", "based_on": "..."}`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      return JSON.parse(this.textOf(message).trim());
    } catch {
      const total = invoicesData.reduce((s, i) => s + i.amount_due, 0);
      return {
        predicted_30d: round2(total * 0.3),
        predicted_60d: round2(total * 0.55),
        predicted_90d: round2(total * 0.7),
        total_outstanding: round2(total),
        confidence: "low",
        based_on: `${invoicesData.length} invoices`,
      };
    }
  }

  private demoCashFlow(invoicesData: { amount_due: number; days_overdue: number; risk_level: string }[]) {
    const recoveryRates: Record<string, number> = { low: 0.88, medium: 0.6, high: 0.25 };
    let p30 = 0;
    let p60 = 0;
    let p90 = 0;

    for (const inv of invoicesData) {
      const amount = inv.amount_due;
      const days = inv.days_overdue;
      const rate = recoveryRates[inv.risk_level ?? "medium"] ?? 0.5;

      if (days <= 15) {
        p30 += amount * rate * 0.75;
        p60 += amount * rate * 0.95;
        p90 += amount * rate;
      } else if (days <= 30) {
        p30 += amount * rate * 0.45;
        p60 += amount * rate * 0.8;
        p90 += amount * rate * 0.95;
      } else if (days <= 60) {
        p30 += amount * rate * 0.2;
        p60 += amount * rate * 0.55;
        p90 += amount * rate * 0.8;
      } else {
        p30 += amount * rate * 0.08;
        p60 += amount * rate * 0.25;
        p90 += amount * rate * 0.5;
      }
    }

    const total = invoicesData.reduce((s, i) => s + i.amount_due, 0);
    return {
      predicted_30d: round2(p30),
      predicted_60d: round2(p60),
      predicted_90d: round2(p90),
      total_outstanding: round2(total),
      confidence: "medium",
      based_on: `${invoicesData.length} overdue invoices`,
    };
  }

  async generateWeeklyReport(
    stats: {
      period?: string;
      total_outstanding?: number;
      total_collected?: number;
      overdue_count?: number;
      escalated_count?: number;
      high_risk_count?: number;
      reminders_sent?: number;
      collection_rate?: number;
      total_clients?: number;
    },
    period = "weekly",
  ): Promise<string> {
    const totalOutstanding = stats.total_outstanding ?? 0;
    const totalCollected = stats.total_collected ?? 0;
    const overdueCount = stats.overdue_count ?? 0;
    const escalatedCount = stats.escalated_count ?? 0;
    const highRiskCount = stats.high_risk_count ?? 0;
    const remindersSent = stats.reminders_sent ?? 0;
    const collectionRate = stats.collection_rate ?? 0;
    const totalClients = stats.total_clients ?? 0;
    const periodDate = stats.period ?? new Date().toISOString().slice(0, 10);

    const periodLabels: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
    const periodLabel = periodLabels[period] ?? "Weekly";

    if (this.demoMode) {
      return this.demoWeeklyReport({
        totalOutstanding,
        totalCollected,
        overdueCount,
        escalatedCount,
        highRiskCount,
        remindersSent,
        collectionRate,
        totalClients,
        periodDate,
        periodLabel,
      });
    }

    const prompt = `You are a senior AR manager. Write a concise ${periodLabel.toLowerCase()} revenue recovery report in markdown.

Data:
- Period: ${periodLabel} (${periodDate})
- Total outstanding: $${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Collected this period: $${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Collection rate: ${collectionRate.toFixed(1)}%
- Overdue invoices: ${overdueCount}
- High-risk clients: ${highRiskCount}
- Reminders sent: ${remindersSent}
- Total clients: ${totalClients}

Include: executive summary, key metrics table, AI insights, recommended actions. Keep it under 600 words.`;

    try {
      const message = await this.client!.messages.create({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });
      return this.textOf(message).trim();
    } catch (err) {
      this.logger.warn(`Live weekly report generation failed, falling back to demo report: ${err}`);
      return this.demoWeeklyReport({
        totalOutstanding,
        totalCollected,
        overdueCount,
        escalatedCount,
        highRiskCount,
        remindersSent,
        collectionRate,
        totalClients,
        periodDate,
        periodLabel,
      });
    }
  }

  private demoWeeklyReport(d: {
    totalOutstanding: number;
    totalCollected: number;
    overdueCount: number;
    escalatedCount: number;
    highRiskCount: number;
    remindersSent: number;
    collectionRate: number;
    totalClients: number;
    periodDate: string;
    periodLabel: string;
  }): string {
    const health = d.collectionRate >= 65 ? "on track" : d.collectionRate >= 45 ? "below target" : "critical";
    const overdueStatus = d.overdueCount > 6 ? "🔴 Urgent" : d.overdueCount > 2 ? "🟡 Moderate" : "✅ Low";
    const highRiskStatus = d.highRiskCount >= 3 ? "🔴 Critical" : d.highRiskCount >= 1 ? "🟡 Monitor" : "✅ None";

    return `## ${d.periodLabel} Revenue Recovery Report — ${d.periodDate}

### Executive Summary

Revenue recovery operations are **${health}** this ${d.periodLabel.toLowerCase()} period. The AI agent has dispatched ${d.remindersSent} automated communications across ${d.totalClients} global clients, maintaining a **${d.collectionRate.toFixed(1)}% collection rate**.

---

### Key Performance Metrics

| Metric | Value | Status |
|---|---|---|
| Total Outstanding | ${fmtMoney(d.totalOutstanding)} | ${d.totalOutstanding > 50000 ? "⚠️ High" : "✅ Normal"} |
| Collected This Period | ${fmtMoney(d.totalCollected)} | ✅ Confirmed |
| Overdue Invoices | ${d.overdueCount} | ${overdueStatus} |
| Escalated Accounts | ${d.escalatedCount} | ${d.escalatedCount > 0 ? "🔴 Action Needed" : "✅ None"} |
| High-Risk Clients | ${d.highRiskCount} | ${highRiskStatus} |
| Reminders Dispatched | ${d.remindersSent} | ✅ Automated |
| Collection Rate | ${d.collectionRate.toFixed(1)}% | ${d.collectionRate >= 65 ? "✅ Healthy" : "⚠️ Low"} |

---

### AI Intelligence Insights

**1. Channel Performance**
WhatsApp reminders are achieving 2.3× higher response rates vs. email for clients in the UAE and Mexico. AI has automatically prioritised WhatsApp for high-risk accounts in Arabic and Spanish-speaking regions.

**2. Language Localisation Impact**
Multi-language reminders (Arabic, German, French, Japanese, Spanish) have reduced average response time by an estimated 35% vs. English-only communications. All messages are AI-generated in the customer's native language.

**3. Cash Flow Forecast**
Based on current risk profiles and recovery patterns:
- **Next 30 days:** ~${fmtMoney(d.totalOutstanding * 0.32)} projected inflow
- **Next 60 days:** ~${fmtMoney(d.totalOutstanding * 0.56)} projected inflow
- **Next 90 days:** ~${fmtMoney(d.totalOutstanding * 0.72)} projected inflow

**4. Risk Alert**
${d.highRiskCount >= 2 ? "⚠️ " + d.highRiskCount + " high-risk account(s) require immediate escalation. Accounts beyond 60 days with 3+ unanswered reminders should be referred to legal/collections this week." : "✅ No critical escalations required this week. Continue standard follow-up cadence."}

---

### Recommended Actions

- ${d.highRiskCount >= 1 ? "☐ Escalate " + d.highRiskCount + " high-risk account(s) to collections/legal" : "✅ No escalations needed"}
- ${d.overdueCount > 0 ? "☐ Send payment plan offers to " + d.overdueCount + " overdue invoices beyond 30 days" : "✅ All invoices within acceptable aging"}
- ☐ Schedule WhatsApp follow-ups for UAE and Mexico accounts this week
- ☐ Review ${d.escalatedCount} escalated case(s) with finance team
- ☐ Update customer risk classifications for accounts with new activity

---

*Generated by RevRecovery AI Agent · Automated Revenue Intelligence*`;
  }

  // ── Document invoice extraction ─────────────────────────────────────────

  private static readonly EXTRACT_PROMPT = `Extract invoice data from this document.
Return ONLY a valid JSON object with exactly these fields (use null for missing):
{
  "invoice_number": "string",
  "customer_name": "string",
  "customer_email": "string",
  "amount": 0.00,
  "currency": "USD",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "description": "string"
}
Rules: amount is a number only (no symbols). Dates must be YYYY-MM-DD. Return ONLY the JSON.`;

  private demoExtractInvoice(filename: string): ExtractedInvoiceResult {
    const seed = md5Seed(filename);
    const rng = new SeededRandom(seed);
    const names = ["James Harrington", "Sofia Nakamura", "Alex Okonkwo", "Maria Garcia", "Wei Chen"];
    const companies = ["Nexus Labs", "Orion Digital", "BrightPath Ltd", "Kestrel Works", "Summit Corp"];
    const currencies = ["USD", "EUR", "GBP", "AED", "AUD"];
    const idx = seed % names.length;

    const today = new Date();
    const issue = new Date(today);
    issue.setUTCDate(issue.getUTCDate() - rng.nextInt(10, 60));
    const due = new Date(issue);
    due.setUTCDate(due.getUTCDate() + rng.nextInt(14, 45));

    return {
      invoice_number: `INV-${today.getUTCFullYear()}-${rng.nextInt(100, 999)}`,
      customer_name: names[idx],
      customer_email: `${names[idx].split(" ")[0].toLowerCase()}@${companies[idx].replace(/\s+/g, "").toLowerCase()}.com`,
      amount: round2(rng.nextFloat(800, 15000)),
      currency: rng.choice(currencies),
      issue_date: issue.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      description: `Professional services — ${companies[idx]}`,
      confidence: "high",
      error: null,
    };
  }

  async extractInvoiceFromDocument(fileContent: Buffer, contentType: string, filename: string): Promise<ExtractedInvoiceResult> {
    if (this.demoMode) {
      return this.demoExtractInvoice(filename);
    }

    try {
      const b64 = fileContent.toString("base64");
      const isPdf = (contentType || "").toLowerCase() === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

      let message: Anthropic.Message;
      if (isPdf) {
        message = await this.client!.messages.create(
          {
            model: VISION_MODEL,
            max_tokens: 512,
            messages: [
              {
                role: "user",
                content: [
                  { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } } as any,
                  { type: "text", text: AiService.EXTRACT_PROMPT },
                ],
              },
            ],
          },
          { headers: { "anthropic-beta": "pdfs-2024-09-25" } },
        );
      } else {
        const safeMt = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType) ? contentType : "image/jpeg") as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp";
        message = await this.client!.messages.create({
          model: VISION_MODEL,
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: safeMt, data: b64 } },
                { type: "text", text: AiService.EXTRACT_PROMPT },
              ],
            },
          ],
        });
      }

      let raw = this.textOf(message).trim();
      if (raw.startsWith("```")) {
        raw = raw.split("\n").slice(1).join("\n");
        if (raw.endsWith("```")) raw = raw.slice(0, -3);
      }
      const data = JSON.parse(raw.trim());
      return {
        invoice_number: String(data.invoice_number ?? ""),
        customer_name: String(data.customer_name ?? ""),
        customer_email: String(data.customer_email ?? ""),
        amount: Number(data.amount ?? 0),
        currency: String(data.currency ?? "USD"),
        issue_date: String(data.issue_date ?? new Date().toISOString().slice(0, 10)),
        due_date: String(data.due_date ?? new Date().toISOString().slice(0, 10)),
        description: String(data.description ?? filename),
        confidence: "high",
        error: null,
      };
    } catch (err) {
      // Never let a bad model id, API error, or malformed response surface as
      // a crash to a public visitor — fall back to the same simulated
      // extraction used in demo mode, with a note that live extraction was
      // unavailable.
      this.logger.warn(`Live invoice extraction failed, falling back to simulated data: ${err}`);
      const fallback = this.demoExtractInvoice(filename);
      fallback.confidence = "low";
      fallback.error = "Live extraction unavailable — showing simulated data.";
      return fallback;
    }
  }

  private textOf(message: Anthropic.Message): string {
    const block = message.content[0];
    if (block && block.type === "text") return block.text;
    return "";
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
