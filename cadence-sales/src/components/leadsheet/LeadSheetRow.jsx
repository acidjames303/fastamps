import React from "react";
import { Button } from "@/components/ui/button";
import LeadSheetStatusBadge from "@/components/leadsheet/LeadSheetStatusBadge";
import { formatLeadSheetDate } from "@/lib/leadSheet";

export default function LeadSheetRow({ sheet, selected, onToggle, onOpen }) {
  const missing = (sheet.missing_fields || []).length;
  const meta = [
    sheet.contact_name,
    sheet.date_called ? formatLeadSheetDate(sheet.date_called) : "",
    sheet.caller_name,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <input
        type="checkbox"
        checked={!!selected}
        onChange={onToggle}
        aria-label={`Select the lead sheet for ${sheet.organisation_name || "this lead"}`}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <button type="button" onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900 truncate">{sheet.organisation_name || "Untitled lead"}</span>
          <LeadSheetStatusBadge status={sheet.status} />
          {missing > 0 && (
            <span className="text-[11px] text-amber-700">{missing} field{missing === 1 ? "" : "s"} missing</span>
          )}
        </div>
        {meta && <p className="text-xs text-slate-500 mt-0.5 truncate">{meta}</p>}
      </button>
      <Button size="sm" variant="ghost" onClick={onOpen} className="rounded-full text-slate-500 shrink-0">
        Open
      </Button>
    </div>
  );
}