import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

// Compact manager strip: what needs attention across campaigns, with a filter toggle.
export default function CampaignAttentionRollup({
  rollup,
  filterOn = false,
  onToggleFilter,
  onActivate,
  onSplit,
  activatingId = "",
}) {
  const navigate = useNavigate();
  if (!rollup) return null;

  if (!rollup.total) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" />
        <span>All campaigns look clear — nothing needs your attention right now.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-amber-200 bg-white text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Needs attention
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {rollup.total} campaign{rollup.total === 1 ? "" : "s"} need a decision
            </p>
            <p className="text-xs text-slate-600">
              Companies, contacts, activation, callers, or info requests — without leaving Campaigns.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={filterOn ? "default" : "outline"}
          onClick={onToggleFilter}
          className={`rounded-full ${filterOn ? "bg-amber-700 hover:bg-amber-600" : "border-amber-300 bg-white"}`}
        >
          {filterOn ? "Showing needs attention" : "Show only these"}
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {rollup.items.map((item) => (
          <li
            key={item.campaignId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{item.campaignName}</p>
              <p className="text-xs text-slate-600">
                <span className="font-medium text-amber-800">{item.label}</span>
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.action === "activate" && (
                <Button
                  size="sm"
                  disabled={activatingId === item.campaignId}
                  onClick={() => onActivate?.(item.campaignId)}
                  className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-500"
                >
                  {activatingId === item.campaignId ? "Activating…" : "Activate"}
                </Button>
              )}
              {item.action === "split" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSplit?.(item.campaignId)}
                  className="h-8 rounded-full"
                >
                  Split data
                </Button>
              )}
              {item.href && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(item.href)}
                  className="h-8 rounded-full"
                >
                  Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {rollup.total > rollup.items.length && (
        <p className="mt-2 text-xs text-amber-900/80">
          Showing {rollup.items.length} of {rollup.total}. Use “Show only these” to focus the list.
        </p>
      )}
    </div>
  );
}
