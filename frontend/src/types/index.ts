export type RiskLevel = "low" | "medium" | "high";

export type InvoiceStatus =
  | "pending"
  | "overdue"
  | "partially_paid"
  | "paid"
  | "disputed"
  | "escalated"
  | "written_off";

export type ReminderChannel = "email" | "whatsapp" | "sms";

export type ReminderType =
  | "first_notice"
  | "second_notice"
  | "final_notice"
  | "payment_plan_offer"
  | "escalation"
  | "confirmation"
  | "custom";

export type ReminderStatus = "sent" | "delivered" | "failed" | "pending";

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  country?: string;
  address?: string;
  risk_level: RiskLevel;
  total_outstanding: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_invoices?: number;
  overdue_invoices?: number;
  total_paid?: number;
}

export interface CustomerCreate {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  country?: string;
  address?: string;
  notes?: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  description?: string;
  days_overdue: number;
  reminder_count: number;
  last_reminder_at?: string;
  escalated_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceCreate {
  invoice_number: string;
  customer_id: number;
  amount: number;
  currency?: string;
  issue_date: string;
  due_date: string;
  description?: string;
}

export interface Reminder {
  id: number;
  customer_id: number;
  invoice_id: number;
  channel: ReminderChannel;
  reminder_type: ReminderType;
  status: ReminderStatus;
  subject?: string;
  message: string;
  ai_generated: boolean;
  sent_at?: string;
  response_received: boolean;
  response_text?: string;
  created_at: string;
}

export interface DashboardSummary {
  summary: {
    total_invoices: number;
    total_billed: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
    overdue_refreshed_count: number;
  };
  by_status: Record<string, { count: number; amount: number }>;
  risk_distribution: { low: number; medium: number; high: number };
  reminders: { sent: number; delivered: number; failed: number };
  top_overdue: {
    id: number;
    invoice_number: string;
    amount_due: number;
    days_overdue: number;
    customer_id: number;
  }[];
}

export interface AgingReport {
  "0_30": { invoices: AgingEntry[]; total: number; count: number };
  "31_60": { invoices: AgingEntry[]; total: number; count: number };
  "61_90": { invoices: AgingEntry[]; total: number; count: number };
  "90_plus": { invoices: AgingEntry[]; total: number; count: number };
}

interface AgingEntry {
  invoice_number: string;
  amount_due: number;
  days_overdue: number;
}

export interface NextAction {
  action: string;
  channel: string | null;
  reminder_type: string | null;
  reason: string;
  urgency: "low" | "medium" | "high";
  label: string;
}

export interface CashFlowPrediction {
  predicted_30d: number;
  predicted_60d: number;
  predicted_90d: number;
  total_outstanding: number;
  confidence: string;
  based_on: string;
}

export interface WeeklyReport {
  report: string;
  stats: Record<string, number | string>;
  generated_at: string;
  period?: string;
}

export interface ExtractedInvoice {
  filename: string;
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
