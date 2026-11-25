import React from "react";
import { Globe } from "lucide-react";

const COUNTRY_OPTIONS = [
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "AE", label: "UAE" },
];

// Geography selector for a ProspectList. Lets the user pick which countries
// companies must be located in. Empty selection = no restriction.
// When "UK only" is requested, stores ["GB"] and enforces it during enrichment.
export default function GeographySelector({ permittedCountries = [], onChange }) {
  const toggle = (code) => {
    if (permittedCountries.includes(code)) {
      onChange(permittedCountries.filter((c) => c !== code));
    } else {
      onChange([...permittedCountries, code]);
    }
  };

  const isUKOnly = permittedCountries.length === 1 && permittedCountries[0] === "GB";

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> Permitted geography
        </label>
        <button
          onClick={() => onChange(["GB"])}
          className={`text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${isUKOnly ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}
        >
          UK only
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COUNTRY_OPTIONS.map((c) => {
          const active = permittedCountries.includes(c.code);
          return (
            <button
              key={c.code}
              onClick={() => toggle(c.code)}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {permittedCountries.length === 0 && (
        <p className="text-xs text-amber-600 mt-2">No restriction — companies from any country will be accepted.</p>
      )}
    </div>
  );
}