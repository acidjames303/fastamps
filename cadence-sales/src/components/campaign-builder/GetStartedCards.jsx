import React from "react";
import { ArrowRight, Compass, FileUp, Mic, PenLine } from "lucide-react";

const CARDS = [
  {
    id: "guided",
    title: "Guide me",
    icon: Compass,
    description: "Answer a few questions with pills and the brief writes itself — including contracts, tenders and buying signals.",
    badge: "Recommended",
  },
  {
    id: "dictate",
    title: "Dictate it",
    icon: Mic,
    description: "Talk the campaign through. Cadence turns what you say into a brief you can edit before it runs.",
  },
  {
    id: "write",
    title: "Write it",
    icon: PenLine,
    description: "Type the brief, the ideal customer profile and the research instruction yourself.",
  },
  {
    id: "import",
    title: "Import existing research",
    icon: FileUp,
    description: "Bring a company list or a research pack you already have — spreadsheets, PDF, Word, Markdown or text.",
  },
];

// Four ways in. Whichever is picked, the draft is the same draft, so switching
// methods never loses what has been written.
export default function GetStartedCards({ onSelect, activeMethod }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold text-slate-900">Get started</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Build the campaign brief and the research instruction, or bring in the research you already have. Everything
          lands in this list, ready to enrich and call.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => {
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
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-slate-900">{card.title}</span>
                {card.badge && (
                  <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {card.badge}
                  </span>
                )}
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
  );
}