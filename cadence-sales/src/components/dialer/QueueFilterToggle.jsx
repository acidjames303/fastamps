import React from "react";
import { Smartphone } from "lucide-react";

// Compact queue filter in the dialer: narrows the company queue to accounts
// that have a mobile number on one of their contacts, so mobile-first calling
// can be worked before the switchboard numbers.
export default function QueueFilterToggle({ active, onToggle, mobileCount, scanning }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title="Show only accounts with a mobile number"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          : "bg-white/5 text-slate-400 border border-white/10 hover:text-white"
      }`}
    >
      <Smartphone className="w-3 h-3" />
      Mobiles only
      <span className={active ? "text-emerald-200/80" : "text-slate-500"}>
        {scanning ? "…" : mobileCount}
      </span>
    </button>
  );
}