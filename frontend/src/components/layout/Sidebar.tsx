"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Bell,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ctLogo from "@/assets/ct logo.png";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        // Base: fixed drawer on mobile, static column on desktop
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 transition-transform duration-200 ease-in-out",
        // Mobile: slide in/out
        open ? "translate-x-0" : "-translate-x-full",
        // Tablet+: always visible, not fixed
        "md:translate-x-0 md:static md:z-auto md:w-60"
      )}
    >
      {/* Logo + mobile close button */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        {/*
          The source PNG is 512×512 with logo content at bbox (38,193,473,291).
          We crop to just the logo by clipping a scaled-down version of the image.
          Scale = 28/98 ≈ 0.2857 → full image renders at ~146px, cropped to 126×28.
        */}
        <div className="overflow-hidden relative shrink-0" style={{ width: "126px", height: "28px" }}>
          <Image
            src={ctLogo}
            alt="CodeThread"
            width={350}
            height={350}
            className="absolute"
            style={{ top: "-45px", left: "-5px" }}
            priority
          />
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-medium text-gray-300 uppercase tracking-widest">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-brand-50 text-brand-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-brand-500" : "text-gray-400 group-hover:text-gray-600"
                )}
              />
              <span className="flex-1">{label}</span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user block */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">Admin</p>
            <p className="text-[10px] text-gray-400 truncate">Finance Team</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
