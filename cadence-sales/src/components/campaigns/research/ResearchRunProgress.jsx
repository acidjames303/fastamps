import React from "react";
import { Button } from "@/components/ui/button";
import { CircleAlert, ExternalLink, Loader2, RotateCcw, Square } from "lucide-react";

const STATUS_TONE = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  skipped: "bg-slate-100 text-slate-500 border-slate-200",
};

// Per-account progress for a bulk research run: what is done, what failed, how
// many attempts each account has had, and the sources found so far.
export default function ResearchRunProgress({ run, busy, onRetry, onCancel, onOpenRecord }) {
  if (!run) return null;

  const items = run.items || [];
  const total = run.total_accounts || items.length || 0;
  const done = run.completed_accounts || items.filter((item) => item.status === "complete").length;
  const failed = run.failed_accounts || items.filter((item) => item.status === "failed").length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const active = ["queued", "processing"].includes(run.status);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">
          {active ? "Researching…" : run.status === "cancelled" ? "Research stopped" : "Research finished"}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {done} of {total} accounts{run.failed_accounts ? ` · ${failed} failed` : ""}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {failed > 0 && !active && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={busy}
              className="rounded-full border-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry failed
            </Button>
          )}
          {active && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              className="rounded-full border-slate-300"
            >
              <Square className="w-3.5 h-3.5 mr-1.5" /> Stop
            </Button>
          )}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {run.error_summary && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <CircleAlert className="w-4 h-4 mt-0.5 flex-none" /> {run.error_summary}
        </p>
      )}

      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li
            key={item.prospect_id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-1.5 text-xs"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{item.company_name}</span>
            {item.status === "processing" && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            <span className={`rounded-full border px-2 py-0.5 ${STATUS_TONE[item.status] || STATUS_TONE.pending}`}>
              {item.status}
              {item.attempts > 1 ? ` · try ${item.attempts}` : ""}
            </span>
            {item.status === "complete" && (
              <span className="text-slate-500">
                {item.findings_count || 0} finding{(item.findings_count || 0) === 1 ? "" : "s"}
                {item.sources ? ` · ${item.sources} source${item.sources === 1 ? "" : "s"}` : ""}
              </span>
            )}
            {item.error && <span className="text-rose-600">{item.error}</span>}
            {item.status === "complete" && item.research_id && onOpenRecord && (
              <button
                type="button"
                onClick={() => onOpenRecord(item.prospect_id)}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800"
              >
                View <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}