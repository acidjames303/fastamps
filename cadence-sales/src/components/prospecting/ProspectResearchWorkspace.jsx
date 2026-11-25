import React, { useState } from "react";
import { BrainCircuit, FileText, Search } from "lucide-react";
import AccountResearchBar from "./AccountResearchBar";
import ResearchPromptPanel from "./ResearchPromptPanel";
import ResearchImportPanel from "./ResearchImportPanel";

const TABS = [
  {
    id: "quick",
    label: "Quick research",
    hint: "AI pass before spending provider credits",
    icon: Search,
  },
  {
    id: "prompt",
    label: "Custom instructions",
    hint: "One natural-language brief for the whole list",
    icon: BrainCircuit,
  },
  {
    id: "import",
    label: "Import document",
    hint: "Paste or upload existing research",
    icon: FileText,
  },
];

/**
 * One research workspace instead of three stacked panels.
 * Same components and APIs — progressive disclosure only.
 */
export default function ProspectResearchWorkspace({
  listId,
  prospects = [],
  onResearched,
  onFindContacts,
  onPromptChanged,
  onResearchLoaded,
  onImported,
}) {
  const [tab, setTab] = useState("quick");
  if (!listId) return null;

  const active = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3 space-y-1">
        <p className="text-xs uppercase tracking-widest text-emerald-700">Research once</p>
        <h3 className="font-display text-lg font-semibold text-slate-900">
          Account research before enrichment
        </h3>
        <p className="text-sm text-slate-500 max-w-2xl">
          Gather what you already know, then find contacts. Findings stay on Dialer and reporting.
        </p>
      </div>

      <div className="px-5 flex flex-wrap gap-1 border-b border-slate-100" role="tablist" aria-label="Research methods">
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-3 py-2 text-sm transition-colors ${
                selected
                  ? "bg-slate-50 text-slate-900 font-medium border border-b-0 border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-5 bg-slate-50/60 space-y-3" role="tabpanel">
        <p className="text-xs text-slate-500">{active.hint}</p>
        {tab === "quick" && (
          <AccountResearchBar
            listId={listId}
            prospects={prospects}
            onResearched={onResearched}
            onFindContacts={onFindContacts}
            embedded
          />
        )}
        {tab === "prompt" && (
          <ResearchPromptPanel
            listId={listId}
            prospects={prospects}
            onChanged={onPromptChanged}
            onResearchLoaded={onResearchLoaded}
            embedded
          />
        )}
        {tab === "import" && (
          <ResearchImportPanel listId={listId} prospects={prospects} onImported={onImported} embedded />
        )}
      </div>
    </section>
  );
}
