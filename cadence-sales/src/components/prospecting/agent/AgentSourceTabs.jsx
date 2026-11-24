import React from "react";
import { Link2, Target, FileText } from "lucide-react";

const MODES = [
  { id: "url", label: "From a URL", icon: Link2, hint: "Point the agent at a customer, competitor or reference site and it builds a lookalike profile." },
  { id: "icp", label: "From an ICP", icon: Target, hint: "Describe the accounts you want — industry, size, geography, buying signals." },
  { id: "brief", label: "From a brief", icon: FileText, hint: "Paste a campaign brief and the agent derives the ICP plus the campaign angle." },
];

export default function AgentSourceTabs({ value, onChange }) {
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`text-left rounded-2xl border p-3 transition-colors ${
              active
                ? "border-emerald-500 bg-emerald-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Icon className={`w-4 h-4 ${active ? "text-emerald-600" : "text-slate-400"}`} /> {m.label}
            </span>
            <span className="block text-[11px] leading-snug text-slate-500 mt-1.5">{m.hint}</span>
          </button>
        );
      })}
    </div>
  );
}