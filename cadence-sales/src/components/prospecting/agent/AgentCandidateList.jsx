import React from "react";
import { ExternalLink, Loader2, Plus, Minus } from "lucide-react";

function FitBadge({ score }) {
  const tone =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`text-xs font-semibold rounded-full border px-2 py-0.5 ${tone}`}>
      {Math.round(score || 0)}
    </span>
  );
}

export default function AgentCandidateList({ candidates, onToggle, busyKey }) {
  if (!candidates?.length) {
    return (
      <p className="text-sm text-slate-500">
        No accounts were returned for this profile. Try a broader ICP or a different reference URL.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {candidates.map((c) => {
        const accepted = c.verdict === "accepted";
        return (
          <div key={`${c.domain || c.name}`} className="px-4 py-3 flex flex-wrap items-start gap-3">
            <FitBadge score={c.fit_score} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                {c.website && (
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-emerald-700 inline-flex items-center gap-0.5"
                  >
                    {c.domain || "website"} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {[c.industry, c.employee_range, c.location].filter(Boolean).join(" · ")}
              </p>
              {(c.fit_reason || c.why_fits) && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.fit_reason || c.why_fits}</p>
              )}
              {!!c.signals?.length && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.signals.map((s) => (
                    <span key={s} className="text-[11px] rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onToggle(c)}
              disabled={busyKey === (c.domain || c.name)}
              className={`text-xs rounded-full border px-3 py-1.5 inline-flex items-center gap-1 transition-colors ${
                accepted
                  ? "border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {busyKey === (c.domain || c.name) ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : accepted ? (
                <Minus className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              {accepted ? "Remove" : "Include"}
            </button>
          </div>
        );
      })}
    </div>
  );
}