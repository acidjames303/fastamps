import React from "react";
import { Filter, AlertCircle, Mail, Phone, CheckCircle2, Building2, ShieldCheck, PhoneOff, CircleSlash } from "lucide-react";
import { emailFlags } from "@/lib/emailDisplay";

// Quick-filter chips for the prospect table — lets users focus on records
// that need attention (missing email, generic only, missing phone, etc.)
const FILTERS = [
  { key: "all", label: "All", icon: Building2 },
  { key: "needs_attention", label: "Needs attention", icon: AlertCircle },
  { key: "generic_only", label: "Generic email only", icon: Mail },
  { key: "no_email", label: "No email", icon: Mail },
  { key: "missing_phone", label: "Missing phone", icon: Phone },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
  { key: "screened_safe", label: "Safe to call", icon: ShieldCheck },
  { key: "screened_listed", label: "Do not call", icon: PhoneOff },
  { key: "screened_unchecked", label: "TPS/CTPS unchecked", icon: CircleSlash },
];

// Checks if a prospect only has a generic company inbox, not a personal email.
function hasGenericEmailOnly(p) {
  return emailFlags(p).isGenericOnly;
}

// Returns true if the prospect matches the given filter key.
export function matchesFilter(prospect, filterKey) {
  switch (filterKey) {
    case "all":
      return true;
    case "needs_attention":
      return !prospect.email || hasGenericEmailOnly(prospect) || !prospect.phone || prospect.enrichment_status === "failed";
    case "generic_only":
      return hasGenericEmailOnly(prospect);
    case "no_email":
      return !prospect.email;
    case "missing_phone":
      return !prospect.phone;
    case "complete":
      return prospect.enrichment_status === "complete";
    case "screened_safe":
      return prospect.tps_ctps_status === "safe";
    case "screened_listed":
      return prospect.tps_ctps_status === "listed";
    case "screened_unchecked":
      return !prospect.tps_ctps_status || prospect.tps_ctps_status === "unchecked";
    default:
      return true;
  }
}

export default function ProspectFilters({ activeFilter, onChange, totalCount, counts }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
      {FILTERS.map((f) => {
        const Icon = f.icon;
        const isActive = activeFilter === f.key;
        const count = counts?.[f.key] ?? 0;
        return (
          <button
            key={f.key}
            onClick={() => onChange(isActive ? "all" : f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Icon className="w-3 h-3" />
            {f.label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${isActive ? "bg-white/20" : "bg-white text-slate-500"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}