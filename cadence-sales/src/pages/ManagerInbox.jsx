import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ManagerInboxPanel from "@/components/team/ManagerInboxPanel";
import QualifiedOpportunitiesPanel from "@/components/team/QualifiedOpportunitiesPanel";

const TABS = [
  { id: "requests", label: "Info requests" },
  { id: "leads", label: "Qualified leads" },
];

export default function ManagerInbox() {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => {
    const raw = params.get("tab");
    return TABS.some((t) => t.id === raw) ? raw : "requests";
  }, [params]);

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    if (id === "requests") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900">Admin inbox</h1>
        <p className="text-slate-500 mt-1">
          One place for caller info requests and qualified opportunities. Prefill what Cadence already knows — nothing auto-sends.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin inbox">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "requests" ? <ManagerInboxPanel /> : <QualifiedOpportunitiesPanel />}
    </div>
  );
}
