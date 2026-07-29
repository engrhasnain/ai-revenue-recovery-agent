"use client";

import { useEffect, useState } from "react";
import {
  Bell, RefreshCw, RotateCcw, MessageSquare,
  CheckCircle2, XCircle, Clock, Mail, MessageCircle, Phone, Zap
} from "lucide-react";
import toast from "react-hot-toast";

import { remindersApi } from "@/lib/api";
import { formatDate, capitalize } from "@/lib/utils";
import type { Reminder } from "@/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

const channelIcon = (channel: string) => {
  const map: Record<string, React.ReactNode> = {
    email:    <Mail className="w-3.5 h-3.5" />,
    whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
    sms:      <Phone className="w-3.5 h-3.5" />,
  };
  return map[channel] ?? null;
};

const channelClass = (c: string) => ({
  email:    "bg-sky-50 text-sky-700 border-sky-100",
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sms:      "bg-violet-50 text-violet-700 border-violet-100",
}[c] ?? "bg-gray-50 text-gray-600");

const statusClass = (s: string) => ({
  sent:      "bg-emerald-50 text-emerald-700",
  delivered: "bg-teal-50 text-teal-700",
  failed:    "bg-rose-50 text-rose-700",
  pending:   "bg-gray-100 text-gray-500",
}[s] ?? "bg-gray-100 text-gray-600");

const statusIcon = (s: string) => {
  if (s === "sent" || s === "delivered") return <CheckCircle2 className="w-3 h-3" />;
  if (s === "failed") return <XCircle className="w-3 h-3" />;
  return <Clock className="w-3 h-3" />;
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("");
  const [selected, setSelected] = useState<Reminder | null>(null);
  const [responseText, setResponseText] = useState("");
  const [analysis, setAnalysis] = useState<Record<string, string> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await remindersApi.list({ channel: channelFilter || undefined });
      setReminders(data);
    } catch {
      toast.error("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [channelFilter]);

  const handleResend = async (r: Reminder) => {
    const t = toast.loading("Resending reminder...");
    try {
      await remindersApi.resend(r.id);
      toast.success("Reminder resent", { id: t });
      load();
    } catch {
      toast.error("Failed to resend", { id: t });
    }
  };

  const handleLogResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const t = toast.loading("Analysing with AI...");
    try {
      const result = await remindersApi.logResponse(selected.id, responseText);
      setAnalysis(result.analysis);
      toast.success("Response logged and analysed", { id: t });
      load();
    } catch {
      toast.error("Failed to log response", { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  const sent   = reminders.filter(r => r.status === "sent" || r.status === "delivered").length;
  const failed = reminders.filter(r => r.status === "failed").length;
  const withReply = reminders.filter(r => r.response_received).length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Sent & delivered", value: String(sent), dot: "bg-emerald-500" },
          { label: "Failed", value: String(failed), dot: "bg-rose-500" },
          { label: "Replies received", value: String(withReply), dot: "bg-brand-500" },
        ].map(({ label, value, dot }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 sm:px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-0.5 leading-none">{value}</p>
            </div>
            <div className={`w-2 h-8 rounded-full ${dot}`} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 overflow-x-auto max-w-full">
        {["", "email", "whatsapp", "sms"].map(ch => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              channelFilter === ch ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {ch === "" ? "All Channels" : <>{channelIcon(ch)} {capitalize(ch)}</>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-56 gap-3">
            <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" />
            <p className="text-sm text-gray-400">Loading reminders...</p>
          </div>
        ) : reminders.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No reminders yet"
            description="Send your first reminder from the Invoices page — AI generates the message automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Invoice", "Channel", "Type", "Status", "AI", "Sent", "Reply", "Actions"].map(h => (
                    <th key={h} className="table-header whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reminders.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell">
                      <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                        #{r.invoice_id}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${channelClass(r.channel)}`}>
                        {channelIcon(r.channel)} {capitalize(r.channel)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                        {capitalize(r.reminder_type)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass(r.status)}`}>
                        {statusIcon(r.status)} {capitalize(r.status)}
                      </span>
                    </td>
                    <td className="table-cell">
                      {r.ai_generated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-1 rounded-full">
                          <Zap className="w-2.5 h-2.5" /> AI
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">Manual</span>
                      )}
                    </td>
                    <td className="table-cell text-gray-500 whitespace-nowrap text-xs">
                      {r.sent_at ? formatDate(r.sent_at) : "—"}
                    </td>
                    <td className="table-cell">
                      {r.response_received ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> Received
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">None</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleResend(r)}
                          className="btn-sm bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 shadow-none"
                          title="Resend"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">Resend</span>
                        </button>
                        <button
                          onClick={() => { setSelected(r); setAnalysis(null); setResponseText(""); }}
                          className="btn-sm bg-brand-50 text-brand-600 hover:bg-brand-100 border-0 shadow-none"
                          title="View"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reminder Detail + Response Modal */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setAnalysis(null); }}
        title="Reminder Details"
        subtitle={selected ? `${capitalize(selected.channel)} · ${capitalize(selected.reminder_type)}` : ""}
        size="lg"
      >
        {selected && (
          <div className="flex flex-col gap-5">
            {/* Scrollable top section */}
            <div className="space-y-4">
              {selected.subject && (
                <div>
                  <p className="label">Subject</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700">
                    {selected.subject}
                  </div>
                </div>
              )}
              <div>
                <p className="label">Message</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                  {selected.message}
                </pre>
              </div>

              {analysis && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5 text-violet-600" />
                    <p className="text-xs font-semibold text-violet-700">AI Analysis</p>
                  </div>
                  {Object.entries(analysis).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-sm">
                      <span className="font-semibold text-violet-600 capitalize shrink-0">{k.replace("_", " ")}:</span>
                      <span className="text-violet-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Log response — always visible at bottom */}
            <form onSubmit={handleLogResponse} className="space-y-3 border-t border-gray-100 pt-4 shrink-0">
              <p className="text-xs font-semibold text-gray-700">Log customer response</p>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Paste the customer's reply here — AI will analyse intent and suggest next action..."
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
              />
              <button type="submit" disabled={submitting || !responseText.trim()} className="btn-primary w-full">
                {submitting
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analysing...</>
                  : <><Zap className="w-3.5 h-3.5" /> Log & Analyse with AI</>
                }
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
