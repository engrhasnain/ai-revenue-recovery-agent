"use client";

import { useRef, useState } from "react";
import {
  Upload, X, CheckCircle2, AlertCircle,
  FileText, ImageIcon, RefreshCw, Plus, Zap,
} from "lucide-react";
import toast from "react-hot-toast";

import { invoicesApi } from "@/lib/api";
import type { Customer, ExtractedInvoice } from "@/types";

type Stage = "upload" | "analyzing" | "review";

type EditableRow = {
  filename: string;
  invoice_number: string;
  customer_id: number | null;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  description: string;
  confidence: "high" | "medium" | "low";
  error: string | null;
  selected: boolean;
};

const ANALYZE_STEPS = ["Reading document...", "Extracting fields...", "Validating data..."];
const CURRENCIES = ["USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD"];

function matchCustomer(customers: Customer[], name: string, email: string): number | null {
  if (!name && !email) return null;
  const n = name.toLowerCase();
  const e = email.toLowerCase();
  const hit = customers.find(
    (c) =>
      c.name.toLowerCase() === n ||
      c.email.toLowerCase() === e ||
      (c.company ?? "").toLowerCase() === n,
  );
  return hit?.id ?? null;
}

function FileIcon({ filename }: { filename: string }) {
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  return isPdf
    ? <FileText className="w-4 h-4 text-rose-500 shrink-0" />
    : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />;
}

export default function ImportInvoicesModal({
  open, onClose, customers, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  onSuccess: () => void;
}) {
  const [stage, setStage] = useState<Stage>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [isDrag, setIsDrag] = useState(false);
  const [fileSteps, setFileSteps] = useState<number[]>([]);
  const [doneFiles, setDoneFiles] = useState<number[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf"),
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !existing.has(f.name))];
    });
  };

  const handleAnalyze = async () => {
    if (!files.length) return;
    setStage("analyzing");
    setFileSteps(files.map(() => 0));
    setDoneFiles([]);

    const apiPromise = invoicesApi.bulkExtract(files);

    for (let fi = 0; fi < files.length; fi++) {
      for (let si = 0; si < ANALYZE_STEPS.length; si++) {
        setFileSteps((prev) => prev.map((s, i) => (i === fi ? si : s)));
        await new Promise((r) => setTimeout(r, 200));
      }
      setDoneFiles((prev) => [...prev, fi]);
    }

    try {
      const results: ExtractedInvoice[] = await apiPromise;
      setRows(
        results.map((r) => ({
          filename: r.filename,
          invoice_number: r.invoice_number,
          customer_id: matchCustomer(customers, r.customer_name, r.customer_email),
          amount: r.amount,
          currency: r.currency || "USD",
          issue_date: r.issue_date,
          due_date: r.due_date,
          description: r.description,
          confidence: r.confidence,
          error: r.error,
          selected: !r.error,
        })),
      );
      setStage("review");
    } catch {
      toast.error("Failed to analyze documents");
      setStage("upload");
    }
  };

  const handleCreate = async () => {
    const toCreate = rows.filter((r) => r.selected && r.customer_id && !r.error);
    if (!toCreate.length) {
      toast.error("Assign a customer to each selected invoice first");
      return;
    }
    setCreating(true);
    let ok = 0;
    for (const row of toCreate) {
      try {
        await invoicesApi.create({
          invoice_number: row.invoice_number || `IMP-${Date.now()}`,
          customer_id: row.customer_id!,
          amount: row.amount,
          currency: row.currency,
          issue_date: row.issue_date,
          due_date: row.due_date,
          description: row.description,
        });
        ok++;
      } catch { /* skip failed */ }
    }
    setCreating(false);
    toast.success(`${ok} invoice${ok !== 1 ? "s" : ""} imported successfully`);
    onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setStage("upload");
    setFiles([]);
    setFileSteps([]);
    setDoneFiles([]);
    setRows([]);
    setCreating(false);
    onClose();
  };

  const setRow = (i: number, patch: Partial<EditableRow>) =>
    setRows((prev) => prev.map((r, ri) => (ri === i ? { ...r, ...patch } : r)));

  const selectedCount = rows.filter((r) => r.selected && r.customer_id && !r.error).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl ring-1 ring-gray-900/8 w-full max-w-2xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Import Invoice Documents</h2>
              <p className="text-xs text-gray-400">
                {stage === "upload" && "Upload images or PDFs — AI will extract the invoice data"}
                {stage === "analyzing" && "AI is reading and extracting data from your documents"}
                {stage === "review" && `Review ${rows.length} extracted invoice${rows.length !== 1 ? "s" : ""} before creating`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* ── Stage 1: Upload ── */}
          {stage === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={(e) => { e.preventDefault(); setIsDrag(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  isDrag
                    ? "border-brand-400 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${isDrag ? "text-brand-500" : "text-gray-300"}`} />
                <p className="text-sm font-semibold text-gray-600">Drop PDF or image files here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse · JPG, PNG, PDF supported</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files!)}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon filename={f.name} />
                        <span className="text-xs font-medium text-gray-700 truncate">{f.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, fi) => fi !== i)); }}
                        className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center shrink-0 ml-2 transition-colors"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Stage 2: Analyzing ── */}
          {stage === "analyzing" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin shrink-0" />
                <p className="text-sm font-bold text-violet-700">AI Analysis in Progress</p>
              </div>
              {files.map((f, fi) => {
                const done = doneFiles.includes(fi);
                const step = fileSteps[fi] ?? 0;
                return (
                  <div
                    key={fi}
                    className={`rounded-xl border p-3.5 transition-all ${
                      done ? "bg-emerald-50 border-emerald-100" : "bg-violet-50 border-violet-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileIcon filename={f.name} />
                          <span className="text-xs font-semibold text-slate-700 truncate">{f.name}</span>
                        </div>
                        <p className={`text-[11px] mt-0.5 font-medium ${done ? "text-emerald-600" : "text-violet-600 animate-pulse"}`}>
                          {done ? "Data extracted" : ANALYZE_STEPS[step]}
                        </p>
                      </div>
                    </div>
                    {!done && (
                      <div className="flex gap-1 mt-2.5 pl-6">
                        {ANALYZE_STEPS.map((_, si) => (
                          <div
                            key={si}
                            className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                              si < step ? "bg-emerald-400" : si === step ? "bg-violet-500" : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Stage 3: Review ── */}
          {stage === "review" && (
            <div className="space-y-3">
              {rows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm font-medium">No invoices could be extracted</p>
                </div>
              )}
              {rows.map((row, ri) => (
                <div
                  key={ri}
                  className={`rounded-xl border p-4 space-y-3 transition-all ${
                    row.error
                      ? "border-rose-200 bg-rose-50"
                      : row.selected
                      ? "border-brand-200 bg-brand-50/40"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={!!row.error}
                        onChange={(e) => setRow(ri, { selected: e.target.checked })}
                        className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                      />
                      <FileIcon filename={row.filename} />
                      <span className="text-xs font-semibold text-gray-600 truncate max-w-[160px]">{row.filename}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        row.confidence === "high" ? "bg-emerald-100 text-emerald-600" :
                        row.confidence === "medium" ? "bg-amber-100 text-amber-600" :
                        "bg-rose-100 text-rose-600"
                      }`}>
                        {row.confidence} confidence
                      </span>
                    </div>
                    <button
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== ri))}
                      className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>

                  {row.error ? (
                    <div className="flex items-start gap-2 text-rose-600">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-xs">{row.error}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 block mb-1">Invoice #</label>
                        <input
                          className="input py-1.5 text-xs"
                          value={row.invoice_number}
                          onChange={(e) => setRow(ri, { invoice_number: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 block mb-1">
                          Customer <span className="text-rose-400">*</span>
                        </label>
                        <select
                          className={`input py-1.5 text-xs ${!row.customer_id ? "border-amber-300 bg-amber-50" : ""}`}
                          value={row.customer_id ?? ""}
                          onChange={(e) => setRow(ri, { customer_id: e.target.value ? Number(e.target.value) : null })}
                        >
                          <option value="">— Select customer —</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.company ? ` (${c.company})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 block mb-1">Amount</label>
                        <div className="flex gap-1.5">
                          <input
                            className="input py-1.5 text-xs flex-1"
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.amount || ""}
                            onChange={(e) => setRow(ri, { amount: parseFloat(e.target.value) || 0 })}
                          />
                          <select
                            className="input py-1.5 text-xs w-20"
                            value={row.currency}
                            onChange={(e) => setRow(ri, { currency: e.target.value })}
                          >
                            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 block mb-1">Due date</label>
                        <input
                          className="input py-1.5 text-xs"
                          type="date"
                          value={row.due_date}
                          onChange={(e) => setRow(ri, { due_date: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-gray-400 block mb-1">Description</label>
                        <input
                          className="input py-1.5 text-xs"
                          value={row.description}
                          onChange={(e) => setRow(ri, { description: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          {stage === "upload" && (
            <>
              <button onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleAnalyze}
                disabled={!files.length}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                <Zap className="w-4 h-4" /> Analyze with AI
              </button>
            </>
          )}
          {stage === "analyzing" && (
            <p className="flex-1 text-center text-xs text-slate-400 font-medium py-2">
              Processing documents, please wait...
            </p>
          )}
          {stage === "review" && (
            <>
              <button onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
              {rows.length > 0 && selectedCount === 0 && (
                <p className="flex-1 text-center text-xs text-amber-500 font-medium py-2 self-center">
                  Assign a customer to create invoices
                </p>
              )}
              {(rows.length === 0 || selectedCount > 0) && (
                <button
                  onClick={handleCreate}
                  disabled={creating || selectedCount === 0}
                  className="btn-primary flex-1"
                >
                  {creating ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create {selectedCount} Invoice{selectedCount !== 1 ? "s" : ""}</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
