"use client";

import { usePathname } from "next/navigation";
import { Bell, LayoutDashboard, FileText, Users, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const pageMeta: Record<string, { title: string; subtitle: string; icon: LucideIcon }> = {
  "/dashboard": { title: "Dashboard",  subtitle: "Revenue recovery overview",             icon: LayoutDashboard },
  "/invoices":  { title: "Invoices",   subtitle: "Track and manage outstanding invoices",  icon: FileText },
  "/customers": { title: "Customers",  subtitle: "Client accounts and risk profiles",       icon: Users },
  "/reminders": { title: "Reminders",  subtitle: "Automated payment reminder history",      icon: Bell },
};

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const meta = pageMeta[pathname] ?? pageMeta["/dashboard"];
  const PageIcon = meta.icon;

  return (
    <header className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-3 justify-between sticky top-0 z-30">
      {/* Left: hamburger (mobile) + page identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Hamburger — only on mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-7 h-7 rounded-lg bg-gray-100 items-center justify-center shrink-0 hidden md:flex">
          <PageIcon className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 leading-tight truncate">{meta.title}</h1>
          <p className="text-xs text-gray-400 mt-px hidden sm:block truncate">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2 shrink-0">
        <button className="relative w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand-500 rounded-full ring-1 ring-white" />
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            A
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-gray-700 leading-tight">Admin</p>
            <p className="text-[10px] text-gray-400">Finance Team</p>
          </div>
        </div>
      </div>
    </header>
  );
}
