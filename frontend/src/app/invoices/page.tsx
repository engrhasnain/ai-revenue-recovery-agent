"use client";

import { useEffect, useState } from "react";
import {
  Plus, RefreshCw, FileText, Send, CheckCircle2,
  Clock, AlertTriangle, Search, Zap
} from "lucide-react";
import toast from "react-hot-toast";

import { invoicesApi, customersApi, remindersApi } from "@/lib/api";
import { formatCurrency, formatDate, statusBadgeClass, capitalize } from "@/lib/utils";
import type { Customer, Invoice, InvoiceCreate, NextAction, Reminder } from "@/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import ImportInvoicesModal from "@/components/ui/ImportInvoicesModal";

const STATUS_OPTIONS = ["", "pending", "overdue", "partially_paid", "paid", "disputed", "escalated"];
const CHANNEL_OPTIONS = ["email", "whatsapp", "sms"];
const REMINDER_TYPES = ["first_notice", "second_notice", "final_notice", "payment_plan_offer", "escalation"];
const CURRENCIES = ["USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD"];

const ACTION_STEPS = [
  "Reading invoice history...",
  "Evaluating customer risk...",
  "Recommending best action...",
];

const SEND_STEPS = [
  "Detecting customer language...",
  "Composing personalised message...",
  "Dispatching reminder...",
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionStep, setActionStep] = useState(0);
  const [sendStep, setSendStep] = useState(-1);
  const [sentReminder, setSentReminder] = useState<Reminder | null>(null);

  const [form, setForm] = useState<InvoiceCreate>({
    invoice_number: "", customer_id: 0, amount: 0,
    currency: "USD", issue_date: "", due_date: "", description: "",
  });

  const [reminderForm, setReminderForm] = useState({
    channel: "email", reminder_type: "first_notice", custom_instructions: "",
  });

  const LANG_LABELS: Record<string, string> = {
    de: "🇩🇪 German", fr: "🇫🇷 French", ja: "🇯🇵 Japanese",
    es: "🇪🇸 Spanish", ar: "🇦🇪 Arabic", pt: "🇧🇷 Portuguese", en: "🇬🇧 English",
  };
  const COUNTRY_LANG: Record<string, string> = {
    "germany": "de", "france": "fr", "japan": "ja", "mexico": "es",
    "spain": "es", "united arab emirates": "ar", "uae": "ar",
    "saudi arabia": "ar", "brazil": "pt",
  };
  const getCustomerLang = (inv: Invoice | null) => {
    if (!inv) return "en";
    const c = customers.find(c => c.id === inv.customer_id);
    return COUNTRY_LANG[(c?.country ?? "").toLowerCase()] ?? "en";
  };

  const load = async () => {
    setLoading(true);
    try {
      const [inv, cust] = await Promise.all([
        invoicesApi.list({ status: statusFilter || undefined }),
        customersApi.list({ limit: 200 }),
      ]);
      setInvoices(inv);
      setCustomers(cust);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = invoices.filter(inv => {
    if (!search) return true;
    const cust = customers.find(c => c.id === inv.customer_id);
    return (
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      cust?.name.toLowerCase().includes(search.toLowerCase()) ||
      cust?.company?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error("Please select a customer");
    setSubmitting(true);
    try {
      await invoicesApi.create(form);
      toast.success("Invoice created");
      setShowCreateModal(false);
      setForm({ invoice_number: "", customer_id: 0, amount: 0, currency: "USD", issue_date: "", due_date: "", description: "" });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    const t = toast.loading(`Marking ${inv.invoice_number} as paid...`);
    try {
      await invoicesApi.markPaid(inv.id);
      toast.success("Invoice marked as paid", { id: t });
      load();
    } catch {
      toast.error("Failed to update", { id: t });
    }
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSubmitting(true);
    setSendStep(0);
    const apiPromise = remindersApi.generateAndSend({
      invoice_id: selectedInvoice.id,
      channel: reminderForm.channel,
      reminder_type: reminderForm.reminder_type,
      custom_instructions: reminderForm.custom_instructions || undefined,
    });
    await new Promise(res => setTimeout(res, 150));
    setSendStep(1);
    await new Promise(res => setTimeout(res, 200));
    setSendStep(2);
    try {
      const result = await apiPromise;
      setSendStep(-1);
      setSentReminder(result);
      setTimeout(() => {
        setShowReminderModal(false);
        setSentReminder(null);
        load();
      }, 1800);
    } catch {
      setSendStep(-1);
      toast.error("Failed to send reminder");
    } finally {
      setSubmitting(false);
    }
  };

  const openReminderModal = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setNextAction(null);
    setSentReminder(null);
    setSendStep(-1);
    setReminderForm({ channel: "email", reminder_type: "first_notice", custom_instructions: "" });
    setShowReminderModal(true);
    setLoadingAction(true);
    setActionStep(0);
    const actionPromise = invoicesApi.nextAction(inv.id);
    await new Promise(res => setTimeout(res, 150));
    setActionStep(1);
    await new Promise(res => setTimeout(res, 150));
    setActionStep(2);
    try {
      const action = await actionPromise;
      if (action.channel && action.reminder_type) {
        setReminderForm(p => ({ ...p, channel: action.channel!, reminder_type: action.reminder_type! }));
      }
      setNextAction(action);
    } catch {
      // AI recommendation is optional
    } finally {
      setLoadingAction(false);
    }
  };

  const customerName = (id: number) => {
    const c = customers.find(c => c.id === id);
    return c ? (c.company ?? c.name) : `#${id}`;
  };

  const customerInitial = (id: number) => {
    const c = customers.find(c => c.id === id);
    return (c?.name ?? "?").charAt(0).toUpperCase();
  };

  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount_due, 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount_due, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total invoices", value: String(invoices.length), color: "text-gray-900", sub: null },
          { label: "Overdue", value: formatCurrency(totalOverdue), color: "text-rose-600", sub: `${invoices.filter(i => i.status === "overdue").length} invoices` },
          { label: "Pending", value: formatCurrency(totalPending), color: "text-amber-600", sub: `${invoices.filter(i => i.status === "pending").length} invoices` },
          { label: "Paid", value: String(invoices.filter(i => i.status === "paid").length), color: "text-emerald-600", sub: "invoices" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-400">{label}</p>
            <p className={`text-2xl font-semibold mt-1 leading-none ${color}`}>{value}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Search invoices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 ml-auto shrink-0">
            <button onClick={() => setShowImportModal(true)} className="btn-secondary">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Invoice</span>
            </button>
          </div>
        </div>
        <div className="flex gap-px bg-white border border-gray-200 rounded-lg p-1 overflow-x-auto max-w-full">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === s ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s === "" ? "All" : capitalize(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-56 gap-3">
            <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" />
            <p className="text-sm text-gray-400">Loading invoices...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description="Create your first invoice to start tracking payments."
            action={
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> New Invoice
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Invoice", "Client", "Amount Due", "Due Date", "Overdue", "Status", "Reminders", "Actions"].map(h => (
                    <th key={h} className="table-header whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="table-row">
                    <td className="table-cell">
                      <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {customerInitial(inv.customer_id)}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{customerName(inv.customer_id)}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`font-bold ${inv.amount_due > 0 ? "text-gray-900" : "text-emerald-600"}`}>
                        {formatCurrency(inv.amount_due, inv.currency)}
                      </span>
                      {inv.amount_paid > 0 && inv.status !== "paid" && (
                        <p className="text-[10px] text-emerald-500 font-medium mt-0.5">
                          {formatCurrency(inv.amount_paid)} paid
                        </p>
                      )}
                    </td>
                    <td className="table-cell text-gray-500">{formatDate(inv.due_date)}</td>
                    <td className="table-cell">
                      {inv.days_overdue > 0 ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-rose-600 font-bold text-sm">{inv.days_overdue}d</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge dot className={statusBadgeClass(inv.status)}>{capitalize(inv.status)}</Badge>
                    </td>
                    <td className="table-cell">
                      {inv.reminder_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                          <Send className="w-3 h-3" /> {inv.reminder_count}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {inv.status !== "paid" && inv.status !== "written_off" ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openReminderModal(inv)}
                            className="btn-sm bg-brand-50 text-brand-600 hover:bg-brand-100 border-0 shadow-none"
                          >
                            <Send className="w-3 h-3" /> Remind
                          </button>
                          <button
                            onClick={() => handleMarkPaid(inv)}
                            className="btn-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0 shadow-none"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 font-medium">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Invoice"
        subtitle="Add an invoice to start tracking and automating follow-ups"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Invoice Number *</label>
              <input className="input" required placeholder="INV-2025-015"
                value={form.invoice_number}
                onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">Customer *</label>
              <select className="input" required value={form.customer_id}
                onChange={e => setForm(p => ({ ...p, customer_id: Number(e.target.value) }))}>
                <option value={0}>— Select customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount *</label>
              <input className="input" type="number" min={0.01} step={0.01} required placeholder="0.00"
                value={form.amount || ""}
                onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency}
                onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Issue Date *</label>
              <input className="input" type="date" required value={form.issue_date}
                onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input className="input" type="date" required value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="e.g. Software Development — Phase 3"
              value={form.description ?? ""}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Creating...</> : "Create Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Documents Modal */}
      <ImportInvoicesModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        customers={customers}
        onSuccess={load}
      />

      {/* Send Reminder Modal */}
      <Modal
        open={showReminderModal}
        onClose={() => { setShowReminderModal(false); setSentReminder(null); setSendStep(-1); }}
        title="Send AI Reminder"
        subtitle="An AI-generated message will be sent to the customer"
      >
        {selectedInvoice && sentReminder ? (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                  sentReminder.channel === "whatsapp" ? "bg-[#25d366]" :
                  sentReminder.channel === "sms" ? "bg-violet-500" : "bg-gray-700"
                }`}>
                  {sentReminder.channel === "whatsapp" ? "W" : sentReminder.channel === "sms" ? "✱" : "✉"}
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">Message Sent!</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Delivered via <span className="font-semibold capitalize">{sentReminder.channel}</span> · {customerName(sentReminder.customer_id)}
                </p>
              </div>
            </div>
            <div className={`rounded-xl border p-4 text-left ${
              sentReminder.channel === "whatsapp" ? "bg-[#e7fbd1] border-[#c3e6a0]" :
              sentReminder.channel === "sms" ? "bg-violet-50 border-violet-100" :
              "bg-gray-50 border-gray-200"
            }`}>
              {sentReminder.subject && (
                <div className="mb-2 pb-2 border-b border-black/5">
                  <p className="text-[11px] font-medium text-gray-400">Subject</p>
                  <p className="text-xs font-semibold text-gray-800 mt-0.5">{sentReminder.subject}</p>
                </div>
              )}
              <p className="text-xs text-gray-700 leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {sentReminder.message}
              </p>
              {sentReminder.channel === "whatsapp" && (
                <p className="text-right text-[10px] text-emerald-700 font-medium mt-2">✓✓ Delivered</p>
              )}
              {sentReminder.channel === "sms" && (
                <p className="text-right text-[10px] text-violet-500 font-medium mt-2">Delivered</p>
              )}
              {sentReminder.channel === "email" && (
                <p className="text-right text-[10px] text-gray-400 font-medium mt-2">Sent to inbox</p>
              )}
            </div>
            <p className="text-center text-xs text-gray-400">Window closes automatically...</p>
          </div>
        ) : selectedInvoice && (
          <form onSubmit={handleSendReminder} className="space-y-4">
            {/* Invoice info card */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                    {selectedInvoice.invoice_number}
                  </span>
                  <p className="font-bold text-gray-900 mt-2">{customerName(selectedInvoice.customer_id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-rose-600">
                    {formatCurrency(selectedInvoice.amount_due, selectedInvoice.currency)}
                  </p>
                  {selectedInvoice.days_overdue > 0 && (
                    <p className="text-xs text-rose-400 font-semibold mt-0.5 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" /> {selectedInvoice.days_overdue} days overdue
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Recommendation Banner */}
            {loadingAction && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin shrink-0" />
                  <p className="text-xs font-bold text-violet-700">AI Analysis in Progress</p>
                </div>
                {ACTION_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 pl-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      i < actionStep ? "bg-emerald-100" :
                      i === actionStep ? "bg-violet-100" : "bg-transparent"
                    }`}>
                      {i < actionStep
                        ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                        : i === actionStep
                        ? <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                        : <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      }
                    </div>
                    <p className={`text-xs transition-all duration-300 ${
                      i < actionStep ? "text-emerald-600" :
                      i === actionStep ? "text-violet-700 font-medium" : "text-gray-400"
                    }`}>{step}</p>
                  </div>
                ))}
              </div>
            )}
            {!loadingAction && nextAction && nextAction.action !== "wait" && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-violet-800">AI Recommends: {nextAction.label}</p>
                      <p className="text-xs text-violet-600 mt-0.5 leading-relaxed">{nextAction.reason}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    nextAction.urgency === "high" ? "bg-rose-100 text-rose-600" :
                    nextAction.urgency === "medium" ? "bg-amber-100 text-amber-600" :
                    "bg-emerald-100 text-emerald-600"
                  }`}>
                    {nextAction.urgency} urgency
                  </span>
                </div>
              </div>
            )}
            {!loadingAction && nextAction && nextAction.action === "wait" && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-700 font-medium">{nextAction.reason}</p>
              </div>
            )}

            {/* Language badge */}
            {(() => {
              const lang = getCustomerLang(selectedInvoice);
              if (lang === "en") return null;
              return (
                <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3.5 py-2.5">
                  <span className="text-base">{LANG_LABELS[lang]?.split(" ")[0]}</span>
                  <p className="text-xs text-sky-700 font-medium">
                    Message will be AI-generated in <span className="font-bold">{LANG_LABELS[lang]?.split(" ")[1]}</span> based on customer location
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Channel</label>
                <select className="input" value={reminderForm.channel}
                  onChange={e => setReminderForm(p => ({ ...p, channel: e.target.value }))}>
                  {CHANNEL_OPTIONS.map(c => (
                    <option key={c} value={c}>{capitalize(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Reminder Type</label>
                <select className="input" value={reminderForm.reminder_type}
                  onChange={e => setReminderForm(p => ({ ...p, reminder_type: e.target.value }))}>
                  {REMINDER_TYPES.map(t => (
                    <option key={t} value={t}>{capitalize(t)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Custom Instructions <span className="text-gray-300 font-normal normal-case">(optional)</span></label>
              <textarea className="input resize-none" rows={2}
                placeholder="e.g. Mention 10% late fee, offer 2-month payment plan..."
                value={reminderForm.custom_instructions}
                onChange={e => setReminderForm(p => ({ ...p, custom_instructions: e.target.value }))} />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                A message will be AI-generated based on the invoice details and sent immediately via the selected channel.
              </p>
            </div>

            {sendStep >= 0 ? (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-[11px] font-medium text-gray-400">Processing…</p>
                {SEND_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      i < sendStep ? "bg-emerald-100" :
                      i === sendStep ? "bg-violet-100" : "bg-gray-100"
                    }`}>
                      {i < sendStep
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        : i === sendStep
                        ? <div className="w-2.5 h-2.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                        : <div className="w-2 h-2 rounded-full bg-gray-300" />
                      }
                    </div>
                    <p className={`text-sm transition-all duration-300 ${
                      i < sendStep ? "text-emerald-500 line-through decoration-emerald-300" :
                      i === sendStep ? "text-gray-900 font-semibold" : "text-gray-300"
                    }`}>{step}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setShowReminderModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  <><Send className="w-3.5 h-3.5" /> Generate & Send</>
                </button>
              </div>
            )}
          </form>
        )}
      </Modal>

    </div>
  );
}
