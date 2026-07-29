"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

const DISMISSED_KEY = "rr-demo-banner-dismissed";

export default function DemoBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // localStorage unavailable (e.g. private browsing) — dismissal just
      // won't persist across reloads, which is fine.
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 sm:px-6 lg:px-8 py-2.5">
      <div className="flex items-start sm:items-center gap-2.5 max-w-screen-2xl mx-auto">
        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
        <p className="flex-1 text-xs text-amber-800 leading-snug">
          You&apos;re viewing a live public demo with sample data. Email, SMS, and WhatsApp
          reminders are <strong className="font-semibold">simulated — nothing is actually sent</strong>,
          and some data resets periodically.
        </p>
        <button
          onClick={dismiss}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
