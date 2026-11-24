import React from "react";

export default function StatCard({ label, value, hint, accent = "text-slate-900" }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-6">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`font-display text-3xl font-semibold mt-2 ${accent}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}