import axios from "axios";
import type {
  AgingReport,
  CashFlowPrediction,
  Customer,
  CustomerCreate,
  DashboardSummary,
  ExtractedInvoice,
  Invoice,
  InvoiceCreate,
  NextAction,
  Reminder,
  WeeklyReport,
} from "@/types";

const BASE = "/api/v1";

const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// No Content-Type default — lets the browser set multipart/form-data + boundary for file uploads
const uploadApi = axios.create({ baseURL: BASE, timeout: 120_000 });

// ── Customers ──────────────────────────────────────────────
export const customersApi = {
  list: (params?: { skip?: number; limit?: number; search?: string; risk_level?: string }) =>
    api.get<Customer[]>("/customers/", { params }).then((r) => r.data),

  get: (id: number) => api.get<Customer>(`/customers/${id}`).then((r) => r.data),

  create: (payload: CustomerCreate) =>
    api.post<Customer>("/customers/", payload).then((r) => r.data),

  update: (id: number, payload: Partial<CustomerCreate>) =>
    api.patch<Customer>(`/customers/${id}`, payload).then((r) => r.data),

  delete: (id: number) => api.delete(`/customers/${id}`),

  refreshRisk: (id: number) =>
    api.post<Customer>(`/customers/${id}/refresh-risk`).then((r) => r.data),
};

// ── Invoices ───────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: { skip?: number; limit?: number; status?: string; customer_id?: number }) =>
    api.get<Invoice[]>("/invoices/", { params }).then((r) => r.data),

  get: (id: number) => api.get<Invoice>(`/invoices/${id}`).then((r) => r.data),

  create: (payload: InvoiceCreate) =>
    api.post<Invoice>("/invoices/", payload).then((r) => r.data),

  update: (id: number, payload: Partial<{ amount_paid: number; status: string; due_date: string; notes: string }>) =>
    api.patch<Invoice>(`/invoices/${id}`, payload).then((r) => r.data),

  delete: (id: number) => api.delete(`/invoices/${id}`),

  markPaid: (id: number) =>
    api.post<Invoice>(`/invoices/${id}/mark-paid`).then((r) => r.data),

  nextAction: (id: number) =>
    api.get<NextAction>(`/invoices/${id}/next-action`).then((r) => r.data),

  bulkExtract: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return uploadApi
      .post<ExtractedInvoice[]>("/invoices/bulk-extract/", form)
      .then((r) => r.data);
  },
};

// ── Reminders ──────────────────────────────────────────────
export const remindersApi = {
  list: (params?: { customer_id?: number; invoice_id?: number; channel?: string }) =>
    api.get<Reminder[]>("/reminders/", { params }).then((r) => r.data),

  get: (id: number) => api.get<Reminder>(`/reminders/${id}`).then((r) => r.data),

  generateAndSend: (payload: {
    invoice_id: number;
    channel: string;
    reminder_type: string;
    custom_instructions?: string;
  }) => api.post<Reminder>("/reminders/generate-and-send/", payload).then((r) => r.data),

  resend: (id: number) =>
    api.post<Reminder>(`/reminders/${id}/resend`).then((r) => r.data),

  logResponse: (id: number, response_text: string) =>
    api.post(`/reminders/${id}/log-response`, { response_text }).then((r) => r.data),

  escalate: (invoiceId: number) =>
    api.post(`/reminders/escalate/${invoiceId}`).then((r) => r.data),
};

// ── Analytics ──────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => api.get<DashboardSummary>("/analytics/dashboard").then((r) => r.data),
  aging: () => api.get<AgingReport>("/analytics/overdue-aging").then((r) => r.data),
  cashFlowPrediction: () => api.get<CashFlowPrediction>("/analytics/cash-flow-prediction").then((r) => r.data),
  weeklyReport: (period = "weekly") =>
    api.get<WeeklyReport>("/analytics/weekly-report", { params: { period } }).then((r) => r.data),
};
