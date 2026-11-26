import React from "react";
import { LEAD_SHEET_STATUSES } from "@/lib/leadSheet";

const TONES = {
  gray: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function LeadSheetStatusBadge({ status }) {
  const meta = LEAD_SHEET_STATUSES[status] || LEAD_SHEET_STATUSES.draft;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[meta.tone] || TONES.gray}`}>
      {meta.label}
    </span>
  );
}