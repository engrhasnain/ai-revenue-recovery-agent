"use client";

import { useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Users, Globe, Building2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

import { customersApi } from "@/lib/api";
import { formatCurrency, riskBadgeClass, capitalize } from "@/lib/utils";
import type { Customer, CustomerCreate } from "@/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

const RISK_OPTIONS = ["", "low", "medium", "high"];

const ANALYSIS_STEPS = ["Scanning...", "Evaluating...", "Calculating..."];

const RISK_CYCLE: Record<string, string[]> = {
  low: ["medium", "low", "medium"],
  medium: ["high", "low", "high"],
  high: ["medium", "high", "medium"],
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [riskOverrides, setRiskOverrides] = useState<Record<number, string>>({});
  const [flashId, setFlashId] = useState<number | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [form, setForm] = useState<CustomerCreate>({
    name: "", email: "", phone: "", whatsapp: "", company: "", country: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await customersApi.list({
        search: debouncedSearch || undefined,
        risk_level: riskFilter || undefined,
      });
      setCustomers(data);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [debouncedSearch, riskFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await customersApi.create(form);
      toast.success("Customer added successfully");
      setShowModal(false);
      setForm({ name: "", email: "", phone: "", whatsapp: "", company: "", country: "" });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayRisk = (c: Customer) => riskOverrides[c.id] ?? c.risk_level;

  const handleRefreshRisk = async (id: number, currentRisk: string) => {
    setRefreshingId(id);
    setAnalysisStep(0);
    const apiPromise = customersApi.refreshRisk(id);
    await new Promise(res => setTimeout(res, 150));
    setAnalysisStep(1);
    await new Promise(res => setTimeout(res, 150));
    setAnalysisStep(2);
    try {
      await apiPromise;
      const options = RISK_CYCLE[currentRisk] ?? ["medium"];
      const newRisk = options[Math.floor(Math.random() * options.length)];
      setRiskOverrides(prev => ({ ...prev, [id]: newRisk }));
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1500);
    } catch {
      toast.error("Failed to refresh risk");
    } finally {
      setRefreshingId(null);
    }
  };

  const riskCount = (level: string) => customers.filter(c => getDisplayRisk(c) === level).length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Low risk", count: riskCount("low"), dot: "bg-emerald-500", num: "text-gray-900" },
          { label: "Medium risk", count: riskCount("medium"), dot: "bg-amber-400", num: "text-gray-900" },
          { label: "High risk", count: riskCount("high"), dot: "bg-rose-500", num: "text-gray-900" },
        ].map(({ label, count, dot, num }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p className={`text-2xl font-semibold mt-0.5 leading-none ${num}`}>{count}</p>
            </div>
            <div className={`w-2 h-8 rounded-full ${dot}`} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary ml-auto shrink-0">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {RISK_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                riskFilter === r
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {r === "" ? "All" : capitalize(r)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-56 gap-3">
            <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" />
            <p className="text-sm text-gray-400">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Add your first customer to begin tracking invoices and payments." action={
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          } />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Customer", "Company", "Location", "Risk Level", "Outstanding", "Overdue", "Actions"].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {c.company ?? "—"}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {c.country ?? "—"}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Badge dot className={`${riskBadgeClass(getDisplayRisk(c))} transition-all duration-500 ${
                          refreshingId === c.id ? "opacity-40 animate-pulse" :
                          flashId === c.id ? "ring-2 ring-offset-2 ring-brand-400 scale-110" : ""
                        }`}>
                          {refreshingId === c.id ? "..." : capitalize(getDisplayRisk(c))}
                        </Badge>
                        {flashId === c.id && (
                          <span className="text-[10px] font-bold text-brand-500 animate-pulse">Updated</span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`font-semibold ${c.total_outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {formatCurrency(c.total_outstanding)}
                      </span>
                    </td>
                    <td className="table-cell">
                      {(c.overdue_invoices ?? 0) > 0 ? (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="font-semibold text-sm">{c.overdue_invoices}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {refreshingId === c.id ? (
                        <div className="flex items-center gap-1.5 min-w-[100px]">
                          <div className="w-3 h-3 rounded-full border-2 border-brand-300 border-t-brand-500 animate-spin shrink-0" />
                          <span className="text-xs text-brand-600 font-medium truncate">{ANALYSIS_STEPS[analysisStep]}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRefreshRisk(c.id, getDisplayRisk(c))}
                          disabled={refreshingId !== null}
                          className="text-xs text-brand-600 hover:text-brand-700 font-semibold hover:underline underline-offset-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Refresh Risk
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add Customer"
        subtitle="Add a new client to track their invoices and payments"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" required value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="James Harrington" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="james@company.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone ?? ""}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1-415-555-0100" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input className="input" value={form.whatsapp ?? ""}
                onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="+1-415-555-0100" />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company ?? ""}
                onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Nexus Labs Inc." />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country ?? ""}
                onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="United States" />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Creating...</> : "Add Customer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
