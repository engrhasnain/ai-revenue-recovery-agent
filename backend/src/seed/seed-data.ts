// Demo dataset — ported field-for-field from
// backend-fastapi-archive/src/app/utils/seed_data.py. This is the single
// source of truth for the demo dataset, reused by both the standalone seed
// script (scripts/seed.ts) and the periodic public-demo reset job
// (src/seed/seed.service.ts) — exactly like the Python version's
// seed_data.py is shared between seed.py and main.py's reset loop.

import { InvoiceStatus, ReminderChannel, ReminderStatus, ReminderType, RiskLevel } from "../common/enums";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  return daysAgo(-days);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export interface SeedCustomer {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  country?: string;
  risk_level: RiskLevel;
  notes?: string;
}

export interface SeedInvoice {
  invoice_number: string;
  customer_idx: number;
  amount: number;
  currency: string;
  issue_date: Date;
  due_date: Date;
  status: InvoiceStatus;
  days_overdue: number;
  amount_paid?: number;
  reminder_count?: number;
  description?: string;
  escalated_at?: Date;
}

export interface SeedReminder {
  customer_idx: number;
  invoice_idx: number;
  channel: ReminderChannel;
  reminder_type: ReminderType;
  status: ReminderStatus;
  subject: string | null;
  message: string;
  sent_at: Date;
  response_received?: boolean;
  response_text?: string;
}

export function buildDataset(): { customers: SeedCustomer[]; invoices: SeedInvoice[]; reminders: SeedReminder[] } {
  const customers: SeedCustomer[] = [
    {
      name: "James Harrington",
      email: "j.harrington@nexuslabs.com",
      phone: "+1-415-555-0181",
      whatsapp: "+1-415-555-0181",
      company: "Nexus Labs Inc.",
      country: "United States",
      risk_level: RiskLevel.LOW,
      notes: "Long-term client, usually pays within 5 days of reminder.",
    },
    {
      name: "Priya Nair",
      email: "priya.nair@deltaforge.co.uk",
      phone: "+44-20-7946-0821",
      whatsapp: "+44-20-7946-0821",
      company: "Delta Forge Ltd.",
      country: "United Kingdom",
      risk_level: RiskLevel.MEDIUM,
      notes: "Occasional delays of 2-3 weeks. Responds to WhatsApp fastest.",
    },
    {
      name: "Khalid Al-Rashidi",
      email: "k.rashidi@pinnaclegroup.ae",
      phone: "+971-4-555-0342",
      whatsapp: "+971-4-555-0342",
      company: "Pinnacle Group FZE",
      country: "United Arab Emirates",
      risk_level: RiskLevel.HIGH,
      notes: "Three escalated invoices in the past year. Requires firm notices.",
    },
    {
      name: "Sophie Laurent",
      email: "sophie@luminartech.fr",
      phone: "+33-1-5555-0193",
      company: "Luminar Technologies",
      country: "France",
      risk_level: RiskLevel.LOW,
      notes: "Excellent payment history. Prefers email communication.",
    },
    {
      name: "Marcus Böhm",
      email: "m.boehm@steelhausgmbh.de",
      phone: "+49-30-5555-0214",
      whatsapp: "+49-30-5555-0214",
      company: "Stahlhaus GmbH",
      country: "Germany",
      risk_level: RiskLevel.MEDIUM,
      notes: "Mid-size manufacturing firm. Pays at end of month cycle.",
    },
    {
      name: "Yuki Tanaka",
      email: "y.tanaka@horizoncorp.co.jp",
      phone: "+81-3-5555-0265",
      company: "Horizon Corporation",
      country: "Japan",
      risk_level: RiskLevel.LOW,
      notes: "Always pays on time. Monthly recurring client.",
    },
    {
      name: "Amara Osei",
      email: "amara.osei@tekafricagroup.com",
      phone: "+233-30-555-0376",
      whatsapp: "+233-30-555-0376",
      company: "TekAfrica Group",
      country: "Ghana",
      risk_level: RiskLevel.HIGH,
      notes: "New client. Two invoices unpaid beyond 60 days.",
    },
    {
      name: "Carlos Mendoza",
      email: "c.mendoza@proyectosg.mx",
      phone: "+52-55-5555-0487",
      whatsapp: "+52-55-5555-0487",
      company: "Proyectos G S.A.",
      country: "Mexico",
      risk_level: RiskLevel.MEDIUM,
      notes: "Responds well to payment plan offers.",
    },
  ];

  const invoices: SeedInvoice[] = [
    // Nexus Labs — 1 overdue, 1 pending
    { invoice_number: "INV-2025-001", customer_idx: 0, amount: 14500.0, currency: "USD", issue_date: daysAgo(45), due_date: daysAgo(15), status: InvoiceStatus.OVERDUE, days_overdue: 15, reminder_count: 2, description: "Q4 Software Integration Services" },
    { invoice_number: "INV-2025-002", customer_idx: 0, amount: 8200.0, currency: "USD", issue_date: daysAgo(10), due_date: daysFromNow(20), status: InvoiceStatus.PENDING, days_overdue: 0, description: "January Retainer Fee" },

    // Delta Forge — 1 overdue (partial), 1 paid
    { invoice_number: "INV-2025-003", customer_idx: 1, amount: 22750.0, currency: "GBP", issue_date: daysAgo(65), due_date: daysAgo(35), status: InvoiceStatus.PARTIALLY_PAID, days_overdue: 35, amount_paid: 10000.0, reminder_count: 3, description: "Custom ERP Module Development" },
    { invoice_number: "INV-2025-004", customer_idx: 1, amount: 5400.0, currency: "GBP", issue_date: daysAgo(90), due_date: daysAgo(60), status: InvoiceStatus.PAID, days_overdue: 0, amount_paid: 5400.0, description: "Support & Maintenance — Nov" },

    // Pinnacle Group — 2 escalated, 1 overdue
    { invoice_number: "INV-2025-005", customer_idx: 2, amount: 48000.0, currency: "AED", issue_date: daysAgo(120), due_date: daysAgo(90), status: InvoiceStatus.ESCALATED, days_overdue: 90, reminder_count: 5, description: "Annual Platform License", escalated_at: hoursAgo(10 * 24) },
    { invoice_number: "INV-2025-006", customer_idx: 2, amount: 31500.0, currency: "AED", issue_date: daysAgo(85), due_date: daysAgo(55), status: InvoiceStatus.OVERDUE, days_overdue: 55, reminder_count: 4, description: "Infrastructure Setup — Phase 2" },

    // Luminar Tech — 1 paid, 1 pending
    { invoice_number: "INV-2025-007", customer_idx: 3, amount: 9800.0, currency: "EUR", issue_date: daysAgo(30), due_date: daysAgo(0), status: InvoiceStatus.PENDING, days_overdue: 0, description: "UX Audit & Redesign" },
    { invoice_number: "INV-2025-008", customer_idx: 3, amount: 7200.0, currency: "EUR", issue_date: daysAgo(75), due_date: daysAgo(45), status: InvoiceStatus.PAID, days_overdue: 0, amount_paid: 7200.0, description: "Brand Identity Package" },

    // Stahlhaus — 1 overdue
    { invoice_number: "INV-2025-009", customer_idx: 4, amount: 17300.0, currency: "EUR", issue_date: daysAgo(55), due_date: daysAgo(25), status: InvoiceStatus.OVERDUE, days_overdue: 25, reminder_count: 2, description: "Industrial IoT Sensors — Batch 3" },

    // Horizon Corp — 2 paid (good client)
    { invoice_number: "INV-2025-010", customer_idx: 5, amount: 12600.0, currency: "USD", issue_date: daysAgo(40), due_date: daysAgo(10), status: InvoiceStatus.PAID, days_overdue: 0, amount_paid: 12600.0, description: "Data Analytics Dashboard — Dec" },
    { invoice_number: "INV-2025-011", customer_idx: 5, amount: 13100.0, currency: "USD", issue_date: daysAgo(10), due_date: daysFromNow(20), status: InvoiceStatus.PENDING, days_overdue: 0, description: "Data Analytics Dashboard — Jan" },

    // TekAfrica — 2 overdue (high risk)
    { invoice_number: "INV-2025-012", customer_idx: 6, amount: 9500.0, currency: "USD", issue_date: daysAgo(100), due_date: daysAgo(70), status: InvoiceStatus.OVERDUE, days_overdue: 70, reminder_count: 4, description: "Cloud Migration — Phase 1" },
    { invoice_number: "INV-2025-013", customer_idx: 6, amount: 7800.0, currency: "USD", issue_date: daysAgo(75), due_date: daysAgo(45), status: InvoiceStatus.OVERDUE, days_overdue: 45, reminder_count: 3, description: "Cloud Migration — Phase 2" },

    // Proyectos G — 1 overdue
    { invoice_number: "INV-2025-014", customer_idx: 7, amount: 6400.0, currency: "USD", issue_date: daysAgo(50), due_date: daysAgo(20), status: InvoiceStatus.OVERDUE, days_overdue: 20, reminder_count: 1, description: "Website Development — Milestone 2" },
  ];

  const reminders: SeedReminder[] = [
    // INV-2025-001 — Nexus Labs
    { customer_idx: 0, invoice_idx: 0, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.FIRST_NOTICE, status: ReminderStatus.DELIVERED, subject: "Friendly Reminder: Invoice INV-2025-001 Payment Due", message: "Dear James,\n\nThis is a friendly reminder that Invoice INV-2025-001 for USD 14,500.00 was due on the 25th. Please arrange payment at your earliest convenience.\n\nBest regards,\nAccounts Receivable Team", sent_at: hoursAgo(10 * 24) },
    { customer_idx: 0, invoice_idx: 0, channel: ReminderChannel.WHATSAPP, reminder_type: ReminderType.SECOND_NOTICE, status: ReminderStatus.SENT, subject: null, message: "Hi James, following up on Invoice INV-2025-001 (USD 14,500.00) — now 15 days overdue. Please settle at your earliest. Reply here if you have any queries.", sent_at: hoursAgo(3 * 24) },

    // INV-2025-003 — Delta Forge
    { customer_idx: 1, invoice_idx: 2, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.FIRST_NOTICE, status: ReminderStatus.DELIVERED, subject: "Invoice INV-2025-003 — Payment Due", message: "Dear Priya,\n\nInvoice INV-2025-003 for GBP 22,750.00 is now 7 days past due. Please arrange payment.\n\nKind regards,\nAccounts Receivable", sent_at: hoursAgo(28 * 24) },
    { customer_idx: 1, invoice_idx: 2, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.SECOND_NOTICE, status: ReminderStatus.DELIVERED, subject: "Second Notice: Invoice INV-2025-003 — 21 Days Overdue", message: "Dear Priya,\n\nThis is a follow-up regarding Invoice INV-2025-003 for GBP 22,750.00 (GBP 10,000 paid, GBP 12,750 outstanding), now 21 days past due.\n\nPlease arrange the remaining payment within 5 business days.", sent_at: hoursAgo(14 * 24), response_received: true, response_text: "Hi, we've sent a partial payment of £10,000. Working on the remainder next week." },
    { customer_idx: 1, invoice_idx: 2, channel: ReminderChannel.WHATSAPP, reminder_type: ReminderType.PAYMENT_PLAN_OFFER, status: ReminderStatus.SENT, subject: null, message: "Hi Priya, we'd like to help you clear the remaining GBP 12,750 on Invoice INV-2025-003 through a flexible payment plan. Reply to discuss options. 📋", sent_at: hoursAgo(5 * 24) },

    // INV-2025-005 — Pinnacle Group (escalated)
    { customer_idx: 2, invoice_idx: 4, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.FIRST_NOTICE, status: ReminderStatus.DELIVERED, subject: "Reminder: Invoice INV-2025-005", message: "Dear Khalid,\n\nInvoice INV-2025-005 for AED 48,000.00 is now due. Please arrange payment.", sent_at: hoursAgo(85 * 24) },
    { customer_idx: 2, invoice_idx: 4, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.SECOND_NOTICE, status: ReminderStatus.DELIVERED, subject: "Second Notice: Invoice INV-2025-005 — 30 Days Overdue", message: "Dear Khalid,\n\nThis is our second reminder for Invoice INV-2025-005 (AED 48,000). Please settle within 5 days.", sent_at: hoursAgo(60 * 24) },
    { customer_idx: 2, invoice_idx: 4, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.FINAL_NOTICE, status: ReminderStatus.DELIVERED, subject: "FINAL NOTICE: Invoice INV-2025-005 — Immediate Action Required", message: "Dear Khalid,\n\nThis is our final notice. Invoice INV-2025-005 (AED 48,000) is 60 days overdue. Pay within 48 hours or this will be escalated to collections.", sent_at: hoursAgo(30 * 24) },
    { customer_idx: 2, invoice_idx: 4, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.ESCALATION, status: ReminderStatus.SENT, subject: "ESCALATED: Invoice INV-2025-005 Referred to Collections", message: "Dear Khalid,\n\nInvoice INV-2025-005 has been formally escalated to our collections department. Contact us within 24 hours to avoid further action.", sent_at: hoursAgo(10 * 24) },

    // INV-2025-012 — TekAfrica
    { customer_idx: 6, invoice_idx: 11, channel: ReminderChannel.EMAIL, reminder_type: ReminderType.FIRST_NOTICE, status: ReminderStatus.DELIVERED, subject: "Payment Reminder: Invoice INV-2025-012", message: "Dear Amara,\n\nInvoice INV-2025-012 for USD 9,500 is now overdue. Please arrange payment.", sent_at: hoursAgo(65 * 24) },
    { customer_idx: 6, invoice_idx: 11, channel: ReminderChannel.WHATSAPP, reminder_type: ReminderType.SECOND_NOTICE, status: ReminderStatus.SENT, subject: null, message: "Hi Amara, following up on Invoice INV-2025-012 (USD 9,500) — 45 days overdue. Please settle ASAP to avoid escalation.", sent_at: hoursAgo(25 * 24) },
  ];

  return { customers, invoices, reminders };
}
