import React from "react";

export const RESEARCH_CRITERIA = [
  { id: "overview", label: "Company overview", text: "company overview, what they do and how they are structured" },
  { id: "verticals", label: "Verticals", text: "the verticals and sectors they serve" },
  { id: "products", label: "Products", text: "their main products and services" },
  { id: "customers", label: "Customers", text: "named customers or the customer types they serve" },
  { id: "size", label: "Size & footprint", text: "employee count, turnover and site footprint" },
  { id: "news", label: "Recent news", text: "recent news from the last 12 months" },
  { id: "growth", label: "Growth plans", text: "published growth plans, expansion or investment" },
  { id: "contracts_awarded", label: "Contracts awarded", text: "contracts this company has been awarded" },
  { id: "contract_expiry", label: "Contract expiry", text: "contract end dates and extension options" },
  { id: "contract_value", label: "Contract value", text: "awarded contract values" },
  { id: "suppliers", label: "Suppliers", text: "named suppliers and incumbent providers" },
  { id: "tenders", label: "Tenders", text: "live or recent tender activity" },
  { id: "projects", label: "Projects", text: "published projects and programmes" },
  { id: "competitors", label: "Competitors", text: "their main competitors" },
  { id: "buying_signals", label: "Buying signals", text: "buying signals relevant to this campaign" },
  { id: "decision_makers", label: "Decision-maker roles", text: "the roles responsible for this decision" },
  { id: "challenges", label: "Business challenges", text: "relevant business challenges or pressures" },
];

// The pills are only a shorthand for the instruction: they compose plain text
// that the existing research run applies, so nothing about the run changes.
export function composeInstruction(selectedIds, customText) {
  const lines = RESEARCH_CRITERIA.filter((item) => selectedIds.includes(item.id)).map((item) => `- ${item.text}`);
  const base = lines.length ? `Find and record, with a source link for each:\n${lines.join("\n")}` : "";
  return [base, String(customText || "").trim()].filter(Boolean).join("\n\n");
}

export default function ResearchCriteriaPills({ value = [], onChange, disabled = false }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {RESEARCH_CRITERIA.map((item) => {
          const active = value.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => toggle(item.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                active
                  ? "border-emerald-300 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        {!!value.length && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2"
          >
            Clear {value.length}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        Pills write the instruction below. Published evidence only — anything the customer confirms is recorded
        separately.
      </p>
    </div>
  );
}