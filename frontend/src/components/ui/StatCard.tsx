import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "brand" | "blue" | "emerald" | "amber" | "rose" | "violet";
  trend?: { label: string; positive: boolean };
}

const accentMap = {
  brand:   { icon: "bg-brand-50 text-brand-500",   bar: "bg-brand-500" },
  blue:    { icon: "bg-blue-50 text-blue-500",     bar: "bg-blue-500" },
  emerald: { icon: "bg-emerald-50 text-emerald-500", bar: "bg-emerald-500" },
  amber:   { icon: "bg-amber-50 text-amber-500",   bar: "bg-amber-500" },
  rose:    { icon: "bg-rose-50 text-rose-500",     bar: "bg-rose-500" },
  violet:  { icon: "bg-violet-50 text-violet-500", bar: "bg-violet-500" },
};

export default function StatCard({ title, value, subtitle, icon: Icon, accent = "brand", trend }: StatCardProps) {
  const { icon: iconClass, bar: barClass } = accentMap[accent];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 relative overflow-hidden">
      {/* Accent bar at top */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", barClass)} />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 pt-px">{title}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconClass)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <p className="text-2xl font-semibold text-gray-900 leading-none tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>}
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium mt-2",
            trend.positive ? "text-emerald-600" : "text-rose-500"
          )}>
            {trend.positive ? "↑" : "↓"} {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
