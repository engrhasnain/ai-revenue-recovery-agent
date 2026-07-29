import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { InvoiceStatus, RiskLevel } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function riskBadgeClass(risk: string): string {
  return ({
    low:    "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    high:   "bg-rose-50 text-rose-700",
  } as Record<string, string>)[risk] ?? "bg-gray-100 text-gray-600";
}

export function statusBadgeClass(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    pending:        "bg-sky-50 text-sky-700",
    overdue:        "bg-amber-50 text-amber-700",
    partially_paid: "bg-yellow-50 text-yellow-700",
    paid:           "bg-emerald-50 text-emerald-700",
    disputed:       "bg-purple-50 text-purple-700",
    escalated:      "bg-rose-50 text-rose-700",
    written_off:    "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}
