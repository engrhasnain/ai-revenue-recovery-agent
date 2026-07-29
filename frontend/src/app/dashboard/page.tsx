"use client";

import { useEffect, useState } from "react";
import {
  DollarSign, FileText, TrendingUp, RefreshCw,
  Clock, CheckCircle2, XCircle, Zap, BarChart2,
  Activity, X, ChevronRight, Printer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import toast from "react-hot-toast";

import { analyticsApi } from "@/lib/api";
import { formatCurrency, capitalize } from "@/lib/utils";
import type { AgingReport, CashFlowPrediction, DashboardSummary, WeeklyReport } from "@/types";
import StatCard from "@/components/ui/StatCard";

const CF_STEPS = [
  "Reading risk profiles...",
  "Applying recovery models...",
  "Projecting 90-day forecast...",
];

const REPORT_STEPS = [
  "Scanning invoice portfolio...",
  "Calculating collection velocity...",
  "Identifying high-risk accounts...",
  "Evaluating reminder effectiveness...",
  "Drafting intelligence report...",
];

const RISK_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];
const AGING_COLORS = ["#E8430A", "#f59e0b", "#fb923c", "#ef4444"];

const CF_COLOR_MAP: Record<string, { card: string; text: string; pct: string; bar: string }> = {
  emerald: { card: "bg-emerald-50/60 border-emerald-100", text: "text-emerald-700", pct: "text-emerald-600", bar: "bg-emerald-500" },
  brand:   { card: "bg-brand-50/60 border-brand-100",     text: "text-brand-700",   pct: "text-brand-600",   bar: "bg-brand-500"   },
  amber:   { card: "bg-amber-50/60 border-amber-100",     text: "text-amber-700",   pct: "text-amber-600",   bar: "bg-amber-500"   },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-gray-300">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly",
};

function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) tableLines.push(lines[i++]);
      const isSep = (l: string) => l.split("|").slice(1, -1).every(c => /^[-:\s]+$/.test(c));
      const rows = tableLines.filter(l => !isSep(l)).map(l => l.split("|").slice(1, -1).map(c => c.trim()));
      if (rows.length > 0) {
        const [header, ...body] = rows;
        out.push(`<table><thead><tr>${header.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>`);
        body.forEach(row => out.push(`<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`));
        out.push("</tbody></table>");
      }
      continue;
    }
    if (line.startsWith("## ")) { out.push(`<h2>${line.slice(3)}</h2>`); i++; continue; }
    if (line.startsWith("### ")) { out.push(`<h3>${line.slice(4)}</h3>`); i++; continue; }
    if (line === "---") { out.push("<hr/>"); i++; continue; }
    if (line.startsWith("- ") || line.startsWith("☐ ") || line.startsWith("✅ ") || line.startsWith("⚠️ ")) {
      out.push(`<li>${line.replace(/^[-☐✅⚠️]\s/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`);
      i++; continue;
    }
    if (line.trim() === "") { out.push("<br/>"); i++; continue; }
    out.push(`<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`);
    i++;
  }
  return out.join("\n");
}

function handlePrint(report: WeeklyReport, period: string) {
  const periodLabel = PERIOD_LABELS[period] ?? "Weekly";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${periodLabel} Recovery Report</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1e293b;font-size:14px;line-height:1.6}
  h1{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:4px}
  .meta{font-size:12px;color:#64748b;margin-bottom:24px}
  h2{font-size:16px;font-weight:700;color:#1e293b;margin-top:28px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
  h3{font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin-top:20px;margin-bottom:6px}
  p,li{color:#475569;margin:4px 0}
  ul{padding-left:20px}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
  th{background:#f8fafc;text-align:left;padding:8px 12px;font-weight:600;border:1px solid #e2e8f0;color:#374151}
  td{padding:7px 12px;border:1px solid #e2e8f0;color:#4b5563}
  tr:nth-child(even) td{background:#f8fafc}
  hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
  .footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px}
  @media print{body{margin:20px}}
</style></head><body>
<h1>${periodLabel} Revenue Recovery Report</h1>
<p class="meta">Generated ${report.generated_at} &nbsp;·&nbsp; AI-authored by RevRecovery Agent</p>
${markdownToHtml(report.report)}
<div class="footer">RevRecovery AI &nbsp;·&nbsp; Automated Revenue Intelligence</div>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

function ReportModal({ report, period, onClose }: { report: WeeklyReport; period: string; onClose: () => void }) {
  const periodLabel = PERIOD_LABELS[period] ?? "Weekly";
  const rawLines = report.report.split("\n");

  type Seg = { type: "table"; rows: string[][] } | { type: "line"; text: string };
  const segments: Seg[] = [];
  let i = 0;
  while (i < rawLines.length) {
    if (rawLines[i].startsWith("|")) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].startsWith("|")) tableLines.push(rawLines[i++]);
      const isSep = (l: string) => l.split("|").slice(1, -1).every(c => /^[-:\s]+$/.test(c));
      const rows = tableLines
        .filter(l => !isSep(l))
        .map(l => l.split("|").slice(1, -1).map(c => c.trim()));
      if (rows.length) segments.push({ type: "table", rows });
    } else {
      segments.push({ type: "line", text: rawLines[i++] });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl ring-1 ring-gray-900/8 w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Recovery Report</h2>
              <p className="text-xs text-gray-400">Generated {report.generated_at} · AI-authored</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(report, period)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-600 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Export
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6 space-y-1 flex-1">
          {segments.map((seg, si) => {
            if (seg.type === "table") {
              const [header, ...body] = seg.rows;
              return (
                <div key={si} className="overflow-x-auto my-3 rounded-xl border border-gray-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {header.map((cell, ci) => (
                          <th key={ci} className="px-3 py-2.5 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{cell}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {body.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-gray-600 border-b border-gray-100 last:border-b-0">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            const line = seg.text;
            if (line.startsWith("## "))
              return <h2 key={si} className="text-lg font-bold text-gray-900 mt-4 mb-1">{line.replace("## ", "")}</h2>;
            if (line.startsWith("### "))
              return <h3 key={si} className="text-sm font-semibold text-gray-700 mt-4 mb-1">{line.replace("### ", "")}</h3>;
            if (line.startsWith("**") && line.endsWith("**"))
              return <p key={si} className="text-sm font-semibold text-gray-800 mt-3">{line.replace(/\*\*/g, "")}</p>;
            if (line.startsWith("- ") || line.startsWith("☐ ") || line.startsWith("✅ ") || line.startsWith("⚠️ "))
              return <p key={si} className="text-sm text-gray-600 pl-3 flex gap-2"><span>•</span><span>{line.replace(/^[-☐✅⚠️]\s/, "")}</span></p>;
            if (line === "---")
              return <hr key={si} className="my-3 border-gray-100" />;
            if (line.trim() === "")
              return <div key={si} className="h-1" />;
            if (line.startsWith("*Generated"))
              return <p key={si} className="text-xs text-gray-400 italic mt-4">{line.replace(/\*/g, "")}</p>;
            return <p key={si} className="text-sm text-gray-600 leading-relaxed">{line.replace(/\*\*/g, "")}</p>;
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowPrediction | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cfLoading, setCfLoading] = useState(true);
  const [cfStep, setCfStep] = useState(0);
  const [reportStep, setReportStep] = useState(0);
  const [simPayments, setSimPayments] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("weekly");

  const load = async () => {
    setLoading(true);
    setCfLoading(true);
    setCfStep(0);
    try {
      const [s, a] = await Promise.all([analyticsApi.dashboard(), analyticsApi.aging()]);
      setSummary(s);
      setAging(a);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
    const cfPromise = analyticsApi.cashFlowPrediction();
    await new Promise(res => setTimeout(res, 150));
    setCfStep(1);
    await new Promise(res => setTimeout(res, 150));
    setCfStep(2);
    try {
      const cf = await cfPromise;
      setCashFlow(cf);
    } catch { /* ignore */ } finally {
      setCfLoading(false);
    }
  };

  const handleWeeklyReport = async () => {
    if (report) { setShowReport(true); return; }
    setLoadingReport(true);
    setReportStep(0);
    const reportPromise = analyticsApi.weeklyReport(reportPeriod);
    const delays = [130, 130, 130, 130];
    for (let i = 1; i < REPORT_STEPS.length; i++) {
      await new Promise(res => setTimeout(res, delays[i - 1]));
      setReportStep(i);
    }
    await new Promise(res => setTimeout(res, 100));
    try {
      const r = await reportPromise;
      setReport(r);
      setShowReport(true);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoadingReport(false);
      setReportStep(0);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    const newPayment = Math.round(Math.random() * 3800 + 600);
    setSimPayments(prev => prev + newPayment);
    setLastRefreshed(new Date());
    setCfLoading(true);
    setCfStep(0);
    const cfPromise = analyticsApi.cashFlowPrediction();
    await new Promise(res => setTimeout(res, 150));
    setCfStep(1);
    await new Promise(res => setTimeout(res, 150));
    setCfStep(2);
    try {
      const cf = await cfPromise;
      setCashFlow(cf);
    } catch { /* ignore */ } finally {
      setCfLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading dashboard...</p>
      </div>
    );
  }

  if (!summary) return null;

  const { summary: s, risk_distribution, by_status, reminders, top_overdue } = summary;
  const displayCollected = s.total_collected + simPayments;
  const displayOutstanding = Math.max(0, s.total_outstanding - simPayments);
  const displayRate = s.total_billed > 0
    ? Math.min(100, Math.round((displayCollected / s.total_billed) * 1000) / 10)
    : s.collection_rate;

  const riskData = [
    { name: "Low Risk", value: risk_distribution.low },
    { name: "Medium Risk", value: risk_distribution.medium },
    { name: "High Risk", value: risk_distribution.high },
  ].filter(d => d.value > 0);

  const agingData = aging ? [
    { name: "1–30 days", amount: aging["0_30"].total, count: aging["0_30"].count },
    { name: "31–60 days", amount: aging["31_60"].total, count: aging["31_60"].count },
    { name: "61–90 days", amount: aging["61_90"].total, count: aging["61_90"].count },
    { name: "90+ days", amount: aging["90_plus"].total, count: aging["90_plus"].count },
  ] : [];

  const overdueCount = by_status["overdue"]?.count ?? 0;
  const escalatedCount = by_status["escalated"]?.count ?? 0;

  const confidence30 = cashFlow ? Math.round((cashFlow.predicted_30d / Math.max(cashFlow.total_outstanding, 1)) * 100) : 0;
  const confidence60 = cashFlow ? Math.round((cashFlow.predicted_60d / Math.max(cashFlow.total_outstanding, 1)) * 100) : 0;
  const confidence90 = cashFlow ? Math.round((cashFlow.predicted_90d / Math.max(cashFlow.total_outstanding, 1)) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: status chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {simPayments > 0 && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              +{formatCurrency(simPayments)} recovered
            </span>
          )}
          {lastRefreshed && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
              Refreshed {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Syncing…" : "Refresh"}</span>
          </button>

          {/* Period picker — abbreviate on small screens */}
          <div className="flex items-center gap-px bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(["weekly", "monthly", "quarterly", "yearly"] as const).map(p => (
              <button
                key={p}
                onClick={() => { setReportPeriod(p); setReport(null); }}
                className={`px-2.5 sm:px-3 py-2 text-xs font-medium transition-all border-r border-gray-200 last:border-r-0 ${
                  reportPeriod === p
                    ? "bg-brand-500 text-white"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <span className="hidden sm:inline">{PERIOD_LABELS[p]}</span>
                <span className="sm:hidden">{PERIOD_LABELS[p].slice(0, 1)}</span>
              </button>
            ))}
          </div>

          {/* AI Report button */}
          <button
            onClick={handleWeeklyReport}
            disabled={loadingReport}
            className="btn-primary btn-md btn"
          >
            {loadingReport
              ? <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="text-xs truncate max-w-[100px] hidden sm:inline">{REPORT_STEPS[reportStep]}</span>
                </span>
              : <><BarChart2 className="w-4 h-4" /><span className="hidden sm:inline"> AI Report</span></>
            }
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(displayOutstanding)}
          subtitle={`${overdueCount + escalatedCount} invoices need action`}
          icon={DollarSign}
          accent="rose"
        />
        <StatCard
          title="Collected"
          value={formatCurrency(displayCollected)}
          subtitle={`${displayRate}% collection rate`}
          icon={TrendingUp}
          accent="emerald"
          trend={{ label: `${displayRate}% rate`, positive: displayRate >= 70 }}
        />
        <StatCard
          title="Total Invoices"
          value={String(s.total_invoices)}
          subtitle={`${overdueCount} overdue · ${escalatedCount} escalated`}
          icon={FileText}
          accent="brand"
        />
        <StatCard
          title="Reminders Sent"
          value={String(reminders.sent + reminders.delivered)}
          subtitle={`${reminders.failed} failed deliveries`}
          icon={Zap}
          accent="brand"
        />
      </div>

      {/* AI Cash Flow Prediction */}
      <div className="card p-6">
        {cfLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-brand-100 animate-spin" style={{ borderTopColor: "#E8430A" }} />
              <div className="absolute inset-3 rounded-full bg-brand-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-brand-600" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">AI Cash Flow Forecast</p>
              <p className="text-xs text-brand-500 font-medium mt-1 animate-pulse">{CF_STEPS[cfStep]}</p>
            </div>
            <div className="flex gap-2">
              {CF_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                  i < cfStep ? "w-5 bg-brand-300" :
                  i === cfStep ? "w-8 bg-brand-500" :
                  "w-1.5 bg-gray-200"
                }`} />
              ))}
            </div>
          </div>
        ) : cashFlow ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-800">Cash Flow Forecast</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Predicted collections · risk-weighted · {cashFlow.based_on}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Zap className="w-3 h-3" /> AI Powered
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Next 30 days", value: cashFlow.predicted_30d, pct: confidence30, color: "emerald" },
                { label: "Next 60 days", value: cashFlow.predicted_60d, pct: confidence60, color: "brand" },
                { label: "Next 90 days", value: cashFlow.predicted_90d, pct: confidence90, color: "amber" },
              ].map(({ label, value, pct, color }) => {
                const c = CF_COLOR_MAP[color];
                return (
                  <div key={label} className={`rounded-xl border p-4 ${c.card}`}>
                    <p className="text-xs font-medium text-gray-500">{label}</p>
                    <p className={`text-xl font-semibold mt-1 ${c.text}`}>{formatCurrency(value)}</p>
                    <div className="mt-2.5">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] font-medium text-gray-400">Recovery rate</span>
                        <span className={`text-[10px] font-semibold ${c.pct}`}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full ${c.bar} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block" />
              Forecast confidence: <span className="font-semibold capitalize text-gray-600">{cashFlow.confidence}</span> · Risk-weighted recovery across all overdue accounts
            </p>
          </>
        ) : null}
      </div>

      {/* Status Strip */}
      <div className="card p-5">
        <p className="text-xs font-medium text-gray-400 mb-4">Invoice breakdown by status</p>
        <div className="divide-y divide-gray-50">
          {Object.entries(by_status).map(([status, data]) => {
            const dotColor: Record<string, string> = {
              pending:        "bg-sky-400",
              overdue:        "bg-amber-400",
              partially_paid: "bg-yellow-400",
              paid:           "bg-emerald-500",
              disputed:       "bg-purple-400",
              escalated:      "bg-rose-500",
              written_off:    "bg-gray-300",
            };
            const textColor: Record<string, string> = {
              paid:      "text-emerald-600",
              escalated: "text-rose-600",
              overdue:   "text-amber-600",
            };
            const totalAmt = Object.values(by_status).reduce((sum, d) => sum + d.count, 0);
            const pct = totalAmt > 0 ? Math.round((data.count / totalAmt) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor[status] ?? "bg-gray-300"}`} />
                <span className="text-xs font-medium text-gray-700 w-24 capitalize">
                  {capitalize(status)}
                </span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${dotColor[status] ?? "bg-gray-300"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold w-8 text-right tabular-nums ${textColor[status] ?? "text-gray-500"}`}>
                  {data.count}
                </span>
                <span className="text-xs text-gray-400 w-20 text-right tabular-nums">
                  {formatCurrency(data.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="card p-5 xl:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-medium text-gray-800">Overdue Aging</h2>
              <p className="text-xs text-gray-400 mt-0.5">Outstanding amounts by overdue period</p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
              {agingData.reduce((s, d) => s + d.count, 0)} invoices
            </span>
          </div>
          {agingData.every(d => d.amount === 0) ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2 text-gray-300">
              <CheckCircle2 className="w-10 h-10 text-emerald-300" />
              <p className="text-xs text-gray-400">No overdue invoices</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingData} barSize={38} barGap={8}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {agingData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5 xl:col-span-2">
          <div className="mb-5">
            <h2 className="text-sm font-medium text-gray-800">Customer Risk Profile</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI-classified · {risk_distribution.low + risk_distribution.medium + risk_distribution.high} clients</p>
          </div>
          {riskData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2 text-gray-300">
              <XCircle className="w-10 h-10" />
              <p className="text-xs text-gray-400">No customers</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={42} paddingAngle={3}>
                  {riskData.map((_, i) => <Cell key={i} fill={RISK_COLORS[i]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "#6b7280" }} />
                <Tooltip formatter={(v: number) => [`${v} customers`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Overdue Table */}
      <div className="card overflow-hidden min-w-0">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-gray-800">Most Overdue</h2>
            <p className="text-xs text-gray-400 mt-0.5">Requires immediate attention</p>
          </div>
          <span className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />
            {top_overdue.length} flagged
          </span>
        </div>
        {top_overdue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-300" />
            <p className="text-sm text-gray-400">No overdue invoices</p>
          </div>
        ) : (
          <div>
            {top_overdue.map((inv, idx) => (
              <div key={inv.id} className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors gap-3">
                <div className="flex items-center gap-4">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    idx === 0
                      ? "bg-brand-100 text-brand-700"
                      : idx === 1
                      ? "bg-rose-50 text-rose-500"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{inv.invoice_number}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-rose-400" />
                      <p className="text-xs text-rose-500 font-medium">{inv.days_overdue}d overdue</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(inv.amount_due)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Client #{inv.customer_id}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Report Modal */}
      {showReport && report && (
        <ReportModal report={report} period={reportPeriod} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
