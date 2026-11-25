import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { OUTCOMES, OUTCOME_CATEGORIES } from "@/lib/outcomeRules";

// Call outcome dropdown for the wrapup panel: one plain list of options, with
// the chosen outcome highlighted in deep navy, matching the familiar CRM list.
// Typing inside the open list searches it (e.g. "v" then Enter for Voicemail),
// so a caller never has to scroll the whole list.
const ALL_OPTIONS = OUTCOME_CATEGORIES.flatMap((cat) =>
  cat.outcomes.map((code) => ({ code, label: OUTCOMES[code].label }))
);

export default function OutcomeSelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const itemRefs = useRef([]);

  const search = query.trim().toLowerCase();

  // Matches start first, then anything containing the typed letters.
  const visible = useMemo(() => {
    if (!search) return ALL_OPTIONS;
    return ALL_OPTIONS
      .filter((o) => o.label.toLowerCase().includes(search))
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(search) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(search) ? 0 : 1;
        return aStarts - bStarts || a.label.localeCompare(b.label);
      });
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, search]);

  const select = (code) => {
    onChange(code);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = visible[activeIndex] || visible[0];
      if (option) select(option.code);
    }
  };

  const selected = OUTCOMES[value];
  const isActive = (code) => (search ? visible[activeIndex]?.code === code : false);

  const renderOption = (code) => {
    const option = OUTCOMES[code];
    const chosen = code === value;
    const active = isActive(code);
    return (
      <button
        key={code}
        ref={(el) => { itemRefs.current[visible.findIndex((o) => o.code === code)] = el; }}
        type="button"
        role="option"
        aria-selected={chosen}
        onMouseEnter={() => setActiveIndex(visible.findIndex((o) => o.code === code))}
        onClick={() => select(code)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
          chosen
            ? "bg-[#262d68] text-white"
            : active
            ? "bg-slate-100 text-slate-900"
            : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span className="truncate">{option.label}</span>
        {chosen && <Check className="w-3.5 h-3.5 shrink-0" />}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-left hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className={selected ? "font-medium text-slate-900" : "text-slate-400"}>
          {selected ? selected.label : "- select -"}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              onKeyDown={onKeyDown}
              placeholder="Type to search outcomes"
              aria-label="Search call outcomes"
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">No outcome matches "{query.trim()}".</p>
            )}

            {search
              ? visible.map((option) => renderOption(option.code))
              : OUTCOME_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-slate-400">
                      {cat.label}
                    </p>
                    {cat.outcomes.map(renderOption)}
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}