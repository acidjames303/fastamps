import React, { useState } from "react";
import {
  ArrowRight,
  Compass,
  FileUp,
  FolderOpen,
  LayoutTemplate,
  Mic,
  PenLine,
  Sparkles,
} from "lucide-react";

const DESCRIBE_OPTIONS = [
  {
    id: "guided",
    title: "Answer with pills",
    icon: Compass,
    description: "Guided questions — objective, market, roles and research write themselves.",
    badge: "Recommended",
  },
  {
    id: "dictate",
    title: "Dictate the brief",
    icon: Mic,
    description: "Talk it through, then edit before anything runs.",
  },
  {
    id: "write",
    title: "Type the brief",
    icon: PenLine,
    description: "Write the brief, ICP and research instruction yourself.",
  },
];

// Four doors that match how people think about starting — not four equal technical modes.
export default function GetStartedCards({
  onSelect,
  activeMethod,
  campaigns = [],
  lists = [],
  listCounts = {},
  templates = [],
  currentListId = "",
  onContinueList,
  onLoadTemplate,
}) {
  const [panel, setPanel] = useState(""); // describe | continue | template | ""

  const continueItems = [
    ...campaigns.map((campaign) => ({
      key: `campaign:${campaign.id}`,
      kind: "campaign",
      id: campaign.id,
      name: campaign.name?.trim() || "Untitled campaign",
      detail: campaign.client_name || "Campaign",
      listId: lists.find((list) => list.campaign_id === campaign.id)?.id || "",
    })),
    ...lists
      .filter((list) => !list.campaign_id || !campaigns.some((campaign) => campaign.id === list.campaign_id))
      .map((list) => ({
        key: `list:${list.id}`,
        kind: "list",
        id: list.id,
        name: list.name?.trim() || "Untitled list",
        detail: listCounts[list.id] != null
          ? `${listCounts[list.id]} compan${listCounts[list.id] === 1 ? "y" : "ies"}`
          : "Prospect list",
        listId: list.id,
      })),
  ].slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Find prospects · start here
        </p>
        <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
          How do you want to find prospects?
        </h2>
        <p className="max-w-2xl text-sm text-slate-500">
          Import research you already have, describe a new campaign, pick up where you left off, or start from a
          template. Same list underneath — nothing is duplicated.
        </p>

        <ol className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
          {[
            "1. Start",
            "2. Companies",
            "3. Review contacts",
            "4. Enrich",
            "5. Call or Outreach",
            "6. Results",
          ].map((step, index) => (
            <li
              key={step}
              className={`rounded-full px-2.5 py-1 ${
                index === 0 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 1. Import */}
        <button
          type="button"
          onClick={() => { setPanel(""); onSelect("import"); }}
          aria-pressed={activeMethod === "import"}
          className={`group flex flex-col items-start gap-3 rounded-3xl border p-5 text-left transition-colors ${
            activeMethod === "import"
              ? "border-emerald-500 bg-emerald-50/70"
              : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
          }`}
        >
          <span className="flex w-full items-center gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <FileUp className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-slate-900">Import existing research</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Excel or CSV — every worksheet merges. Preview companies, catch duplicates, then save.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 flex-none text-emerald-700 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        {/* 2. Describe */}
        <div
          className={`rounded-3xl border p-5 transition-colors ${
            panel === "describe" || ["guided", "dictate", "write"].includes(activeMethod)
              ? "border-emerald-500 bg-emerald-50/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => setPanel((current) => (current === "describe" ? "" : "describe"))}
            className="flex w-full items-start gap-3 text-left"
            aria-expanded={panel === "describe"}
          >
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-sky-100 text-sky-700">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-slate-900">Describe my campaign</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Type or dictate what you want — or answer with pills. Cadence builds the brief, ICP and research ask.
              </span>
            </span>
            <span className="text-xs font-medium text-emerald-700">{panel === "describe" ? "Hide" : "Choose"}</span>
          </button>

          {panel === "describe" && (
            <div className="mt-4 grid gap-2">
              {DESCRIBE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect(option.id)}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-300"
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{option.title}</span>
                        {option.badge && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            {option.badge}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                    </span>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 flex-none text-emerald-700" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Continue */}
        <div
          className={`rounded-3xl border p-5 transition-colors ${
            panel === "continue" ? "border-emerald-500 bg-emerald-50/40" : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => setPanel((current) => (current === "continue" ? "" : "continue"))}
            className="flex w-full items-start gap-3 text-left"
            aria-expanded={panel === "continue"}
          >
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <FolderOpen className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-slate-900">Continue an existing campaign</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Open a previous campaign or list with its brief, companies and progress intact.
              </span>
            </span>
            <span className="text-xs font-medium text-emerald-700">{panel === "continue" ? "Hide" : "Open"}</span>
          </button>

          {panel === "continue" && (
            <div className="mt-4 space-y-2">
              {continueItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No campaigns or lists yet — import research or describe a new campaign first.
                </p>
              ) : (
                continueItems.map((item) => {
                  const active = item.listId && item.listId === currentListId;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.listId) onContinueList?.(item.listId);
                        else if (item.kind === "campaign") onContinueList?.(`campaign:${item.id}`);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left ${
                        active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.name}</span>
                        <span className="block text-xs text-slate-500">{item.detail}</span>
                      </span>
                      <span className="text-xs font-medium text-emerald-700">{active ? "Current" : "Open"}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 4. Template */}
        <div
          className={`rounded-3xl border p-5 transition-colors ${
            panel === "template" ? "border-emerald-500 bg-emerald-50/40" : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => setPanel((current) => (current === "template" ? "" : "template"))}
            className="flex w-full items-start gap-3 text-left"
            aria-expanded={panel === "template"}
          >
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-violet-100 text-violet-700">
              <LayoutTemplate className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-slate-900">Start from a template</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Reuse a saved or built-in campaign shape, then customise before finding accounts.
              </span>
            </span>
            <span className="text-xs font-medium text-emerald-700">{panel === "template" ? "Hide" : "Browse"}</span>
          </button>

          {panel === "template" && (
            <div className="mt-4 space-y-2">
              {templates.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No templates yet — describe a campaign once and save it as a template from the review step.
                </p>
              ) : (
                templates.slice(0, 8).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onLoadTemplate?.(template.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-emerald-300"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{template.name}</span>
                      <span className="block text-xs text-slate-500">
                        {template.description || "Campaign template"}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 flex-none text-emerald-700" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
