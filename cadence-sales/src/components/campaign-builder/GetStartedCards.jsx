import React from "react";
import { ArrowRight, Compass, FileUp, Mic, PenLine } from "lucide-react";

const PRIMARY = {
  id: "import",
  title: "Import existing research",
  icon: FileUp,
  description:
    "Drop a company spreadsheet or research pack. Every Excel worksheet merges into one list — nothing already on this campaign is overwritten.",
  badge: "Your path",
};

const SECONDARY = [
  {
    id: "guided",
    title: "Guide me",
    icon: Compass,
    description: "Answer a few questions and the brief writes itself.",
  },
  {
    id: "dictate",
    title: "Dictate it",
    icon: Mic,
    description: "Talk the campaign through, then edit before it runs.",
  },
  {
    id: "write",
    title: "Write it",
    icon: PenLine,
    description: "Type the brief, ICP and research instruction yourself.",
  },
];

// Four ways in. Import is the primary door on Find prospects — the other three
// stay available without competing for the first glance.
export default function GetStartedCards({ onSelect, activeMethod }) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 sm:p-6 space-y-4 shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Campaigns · Find prospects · updated
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
            Start with the research you already have
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            This is the Find prospects workspace. Import a company list first — Cadence shows every worksheet it
            read before anything is saved.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelect(PRIMARY.id)}
          aria-pressed={activeMethod === PRIMARY.id}
          className="group flex w-full flex-col items-start gap-3 rounded-2xl border border-emerald-500 bg-white p-5 text-left shadow-sm transition-colors hover:bg-emerald-50/50 sm:flex-row sm:items-center"
        >
          <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <FileUp className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-900">{PRIMARY.title}</span>
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {PRIMARY.badge}
              </span>
            </span>
            <span className="block text-sm leading-relaxed text-slate-600">{PRIMARY.description}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white group-hover:bg-emerald-500">
            Open company list <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Or build a brief from scratch</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {SECONDARY.map((card) => {
            const Icon = card.icon;
            const active = activeMethod === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelect(card.id)}
                aria-pressed={active}
                className={`group flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                  active
                    ? "border-emerald-500 bg-emerald-50/70"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                }`}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-100 text-slate-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{card.title}</span>
                </span>
                <span className="text-xs leading-relaxed text-slate-500">{card.description}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-emerald-700">
                  Start <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
