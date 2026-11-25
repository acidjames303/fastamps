import React from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

const CHIPS = [
  { key: "hasMobile", label: "Has mobile" },
  { key: "hasNumber", label: "Has number" },
  { key: "hasEmail", label: "Has email" },
  { key: "notCalled", label: "Not called yet" },
];

export default function CompanyFilterBar({ filters, setFilters, industries = [], total = 0, shown = 0, active, onClear }) {
  const toggle = (key) => setFilters((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="mt-4 space-y-2.5">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={filters.query}
          onChange={(e) => setFilters((current) => ({ ...current, query: e.target.value }))}
          placeholder="Search company, domain or location…"
          className="rounded-xl border-slate-200 pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => toggle(chip.key)}
            aria-pressed={!!filters[chip.key]}
            className={`text-xs rounded-full border px-3 py-1 transition-colors ${
              filters[chip.key]
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-slate-200 text-slate-500 hover:border-slate-400"
            }`}
          >
            {chip.label}
          </button>
        ))}

        {industries.length > 0 && (
          <select
            value={filters.industry}
            onChange={(e) => setFilters((current) => ({ ...current, industry: e.target.value }))}
            className="text-xs rounded-full border border-slate-200 bg-white text-slate-600 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">All industries</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        )}

        {active && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs rounded-full px-2.5 py-1 text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {active && (
        <p className="text-xs text-slate-500">Showing {shown} of {total} companies</p>
      )}
    </div>
  );
}