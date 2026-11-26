import React from "react";
import { Phone, PhoneOff, CheckCircle2, AlertCircle, Pencil, Smartphone } from "lucide-react";
import LushaBadge, { isLushaSource } from "@/components/phones/LushaBadge";

// Selectable list of decision-maker Contacts under the current Company.
// Clicking a row selects it as the person to dial. Reuses one
// CompanyIntelligence record across every contact shown here.
export default function DecisionMakerList({ contacts, selectedId, onSelect, onEdit }) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center">
        <AlertCircle className="w-4 h-4 mx-auto text-slate-400" />
        <p className="text-sm text-slate-500 mt-2">No decision-makers linked to this company yet.</p>
        <p className="text-xs text-slate-400 mt-1">Add contacts from Data or Import to dial them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((c) => {
        const active = c.id === selectedId;
        const undialable = ["bad", "dnc"].includes(c.number_status) || !c.phone;
        return (
          <div
            key={c.id}
            className={`flex items-stretch rounded-2xl border transition-colors ${
              active
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="flex-1 min-w-0 text-left px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{c.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.job_title || "Role unknown"}</p>
                </div>
                {active && <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0" />}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                {c.phone ? (
                  <span className={`inline-flex items-center gap-1 ${
                    undialable ? "text-rose-500"
                      : isLushaSource(c.phone_source) ? "text-purple-800 font-medium"
                      : "text-slate-600"
                  }`}>
                    {undialable ? <PhoneOff className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                    {c.phone}
                    {isLushaSource(c.phone_source) ? <LushaBadge /> : null}
                  </span>
                ) : (
                  <span className="text-slate-400">No number</span>
                )}
                {c.lusha_mobile && String(c.lusha_mobile).replace(/\D/g, "") !== String(c.phone || "").replace(/\D/g, "") ? (
                  <span className="inline-flex items-center gap-1 text-purple-800 font-medium">
                    <Smartphone className="w-3 h-3" />
                    {c.lusha_mobile}
                    <LushaBadge />
                  </span>
                ) : null}
                {(c.call_count || 0) > 0 && (
                  <span className="text-amber-600">Called {c.call_count}×</span>
                )}
                {c.number_status === "bad" && <span className="text-rose-500">Bad number</span>}
                {c.number_status === "dnc" && <span className="text-rose-500">Do not call</span>}
              </div>
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(c)}
                aria-label={`Edit ${c.full_name}`}
                title="Edit contact"
                className="shrink-0 px-3 border-l border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-r-2xl"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}