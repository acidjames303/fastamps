import React from "react";
import { Search, BadgeCheck, Database, PhoneCall, Loader2, AlertTriangle, Check } from "lucide-react";

const STEPS = [
  { key: "context", label: "Reading the context", icon: Search },
  { key: "discover", label: "Finding and scoring accounts", icon: BadgeCheck },
  { key: "save", label: "Saving qualified accounts", icon: Database },
  { key: "enrich", label: "Enriching decision-makers", icon: PhoneCall },
];
const ORDER = ["context", "discover", "save", "enrich", "done"];

export default function AgentRunProgress({ run, session }) {
  if (!run) return null;
  const activeIndex = ORDER.indexOf(run.current_phase || "context");
  const failed = run.status === "failed";

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {STEPS.map((step, i) => {
          const done = activeIndex > i || run.status === "completed" && i < 4;
          const active = activeIndex === i && !failed;
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className={`rounded-2xl border p-3 ${
                done
                  ? "border-emerald-200 bg-emerald-50"
                  : active
                    ? "border-slate-300 bg-white"
                    : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {done ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : active ? (
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4 text-slate-400" />
                )}
                <span className={`text-xs font-medium ${done || active ? "text-slate-900" : "text-slate-400"}`}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span><strong className="text-slate-800">{run.accounts_found || 0}</strong> found</span>
        <span><strong className="text-emerald-700">{run.accounts_qualified || 0}</strong> qualified</span>
        <span><strong className="text-slate-500">{run.accounts_rejected || 0}</strong> below fit</span>
        {session && (
          <span>
            Enrichment: <strong className="text-slate-800">{session.completed_count || 0}</strong> of{" "}
            {session.total_records || 0} done
          </span>
        )}
      </div>

      {failed && (
        <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{run.error_summary || "The run stopped before it could finish."}</span>
        </div>
      )}
    </div>
  );
}