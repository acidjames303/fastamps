import React, { useState } from "react";
import { Check, Plus, X } from "lucide-react";

const labelOf = (option) => (typeof option === "string" ? option : option?.label || "");
const valueOf = (option) => (typeof option === "string" ? option : option?.key || option?.label || "");

// Large pill bubbles with a visible tick. Single-select behaves like a radio
// group; multi-select collects a list, and `ordered` records the tap order.
export default function PillSelect({
  options = [],
  value,
  onChange,
  multi = true,
  ordered = false,
  customLabel = "",
  allowCustom = true,
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const selected = multi ? (Array.isArray(value) ? value : []) : [value].filter(Boolean);
  const chosenValues = selected.map(valueOf);

  const toggle = (option) => {
    const next = valueOf(option);
    if (!multi) {
      onChange(chosenValues[0] === next ? "" : next);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    onChange(
      current.includes(next) ? current.filter((item) => item !== next) : [...current, next],
    );
  };

  const addCustom = () => {
    const text = draft.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    if (multi) {
      const current = Array.isArray(value) ? value : [];
      if (!current.includes(text)) onChange([...current, text]);
    } else {
      onChange(text);
    }
    setDraft("");
    setAdding(false);
  };

  const extras = selected.filter(
    (item) => !options.some((option) => labelOf(option) === labelOf(item) || valueOf(option) === item),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const optionValue = valueOf(option);
          const active = chosenValues.includes(optionValue);
          const order = ordered && active ? chosenValues.indexOf(optionValue) + 1 : 0;
          return (
            <button
              key={optionValue}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60"
              }`}
            >
              {order ? (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-white/25 text-[10px] font-semibold">
                  {order}
                </span>
              ) : active ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {labelOf(option)}
            </button>
          );
        })}

        {extras.map((item) => (
          <button
            key={valueOf(item)}
            type="button"
            aria-pressed
            onClick={() => toggle(item)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm"
          >
            <Check className="h-3.5 w-3.5" />
            {labelOf(item)}
            <X className="h-3 w-3 opacity-70" />
          </button>
        ))}

        {allowCustom && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {customLabel || (multi ? "Add your own" : "Something else")}
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
              if (event.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder={customLabel || "Type your own"}
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setAdding(false);
            }}
            className="rounded-full px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}