import React, { useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Smartphone, Sparkles, ArrowRight, Trash2, Loader2, Check, PhoneCall } from "lucide-react";
import ProspectDiagnosticsDialog from "./ProspectDiagnosticsDialog";
import AccountResearchDetail from "./AccountResearchDetail";
import ScreeningBadge from "./ScreeningBadge";
import PhoneCandidates from "./PhoneCandidates";
import ProspectPersonCard from "./ProspectPersonCard";
import { emailFlags } from "@/lib/emailDisplay";
import { isUkMobileNumber } from "@/lib/enrichmentRun";

const statusStyle = {
  enriched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_enriched: "bg-amber-50 text-amber-700 border-amber-200",
  no_contact_details: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  enriching: "bg-blue-50 text-blue-700 border-blue-200",
  not_found: "bg-slate-100 text-slate-500 border-slate-200",
  out_of_scope: "bg-rose-50 text-rose-700 border-rose-200",
  provider_unavailable: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const callStatusStyle = {
  attempted: "bg-amber-50 text-amber-700 border-amber-200",
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  callback: "bg-blue-50 text-blue-700 border-blue-200",
};

const callStatusLabel = { attempted: "Called", connected: "Spoken", callback: "Callback" };

// Checks if the prospect only has a generic company inbox, not a personal email.
function hasGenericEmailOnly(p) {
  return emailFlags(p).isGenericOnly;
}

function scoreTone(s) {
  if (s >= 75) return "bg-emerald-600 text-white";
  if (s >= 50) return "bg-amber-500 text-white";
  return "bg-slate-300 text-slate-700";
}

export default function ProspectTable({ prospects, selected, setSelected, onEnrich, onPush, onDelete, onToggleCall, onFindPhone, busyId, researchByProspect = {}, onPhoneChange }) {
  const [numbersOpen, setNumbersOpen] = useState(null);
  const [diagProspect, setDiagProspect] = useState(null);
  const [researchRecord, setResearchRecord] = useState(null);
  const all = prospects.length > 0 && selected.length === prospects.length;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected(all ? [] : prospects.map((p) => p.id));

  // Shift-click range selection — click a row, then shift+click another to
  // select all rows in between.
  const lastClickedRef = useRef(null);
  const handleRowClick = (e, prospect, index) => {
    if (e.shiftKey && lastClickedRef.current !== null) {
      const start = Math.min(lastClickedRef.current, index);
      const end = Math.max(lastClickedRef.current, index);
      const rangeIds = prospects.slice(start, end + 1).map((p) => p.id);
      setSelected((prev) => [...new Set([...prev, ...rangeIds])]);
    } else {
      lastClickedRef.current = index;
    }
  };

  if (prospects.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
        <p className="px-5 py-12 text-slate-400 text-sm">No prospects yet. Add companies and run enrichment.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden" data-cadence-build="people-v3">
      {/* Desktop table header — all people visible; no separate Number column */}
      <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
        <span className="col-span-1 flex items-center"><Checkbox checked={all} onCheckedChange={toggleAll} /></span>
        <span className="col-span-3">Company</span>
        <span className="col-span-5">People · mobiles · emails</span>
        <span className="col-span-1">Fit / status</span>
        <span className="col-span-2 text-right">Actions</span>
      </div>
      {prospects.map((p, index) => {
        const contacts = Array.isArray(p.contacts) ? p.contacts : [];
        const mobileCount = contacts.filter((c) => isUkMobileNumber(c.mobile || c.phone)).length;
        const emailCount = contacts.filter((c) => c.email).length;
        const isBusy = busyId === p.id;
        return (
          <div key={p.id} className="border-t border-slate-100">
            {/* Desktop grid row */}
            <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 items-start text-sm">
              <span className="col-span-1 pt-1"><Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} onClick={(e) => handleRowClick(e, p, index)} /></span>
              <div className="col-span-3 space-y-1.5">
                <div>
                  <p className="font-medium text-slate-900">{p.company_name}</p>
                  <p className="text-xs text-slate-400">{[p.industry, p.employee_range, p.location].filter(Boolean).join(" · ")}</p>
                </div>
                {p.landline && (
                  <a href={`tel:${p.landline.replace(/\s+/g, '')}`} className="text-xs text-slate-600 flex items-center gap-1 hover:text-emerald-600">
                    <Phone className="w-3 h-3" /> Switchboard · {p.landline}
                  </a>
                )}
                <p className="text-[11px] text-slate-500">
                  {contacts.length} people · {mobileCount} mobile{mobileCount === 1 ? "" : "s"} · {emailCount} email{emailCount === 1 ? "" : "s"}
                </p>
                <ScreeningBadge prospect={p} />
                <button
                  type="button"
                  onClick={() => setNumbersOpen(numbersOpen === p.id ? null : p.id)}
                  className="text-[10px] text-slate-500 hover:text-slate-800"
                >
                  {numbersOpen === p.id ? "Hide number candidates" : "Number candidates"}
                </button>
                {numbersOpen === p.id && (
                  <div className="mt-1">
                    <PhoneCandidates prospect={p} onPreferred={onPhoneChange} />
                  </div>
                )}
                {p.call_status && p.call_status !== 'new' && (
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border mt-1 ${callStatusStyle[p.call_status] || ''}`}>
                    {callStatusLabel[p.call_status] || p.call_status}
                  </span>
                )}
              </div>
              <div className="col-span-5">
                {contacts.length === 0 ? (
                  <p className="text-slate-400 text-sm py-2">No decision-makers found yet — run Maximum search.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-1 xl:grid-cols-2">
                    {contacts.map((c, i) => (
                      <ProspectPersonCard key={`${c.name || "person"}-${i}`} contact={c} />
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-1 pt-0.5 space-y-1.5">
                {researchByProspect[p.id] ? (
                  <button
                    type="button"
                    onClick={() => setResearchRecord(researchByProspect[p.id])}
                    className="text-xs text-emerald-700 underline-offset-2 hover:underline"
                  >
                    see research
                  </button>
                ) : p.fit_score ? (
                  <span className={`inline-flex items-center justify-center w-9 h-6 rounded-full text-xs font-semibold ${scoreTone(p.fit_score)}`}>{p.fit_score}</span>
                ) : null}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusStyle[p.enrichment_status] || statusStyle.not_found}`}>
                  {p.enrichment_status?.replace("_", " ") || "pending"}
                </span>
                {hasGenericEmailOnly(p) && (
                  <span className="block text-[10px] text-amber-600 leading-tight" title="This record only has a generic company inbox — a personal work email is still needed">
                    Generic email only
                  </span>
                )}
                {p.provider_error && p.enrichment_status !== 'pending' && p.enrichment_status !== 'enriching' && (
                  <button onClick={() => setDiagProspect(p)} className="block text-[10px] text-slate-400 leading-tight hover:text-slate-700 transition-colors">
                    Why no email? →
                  </button>
                )}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-0.5 pt-0.5">
                {p.pushed && (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs" title="Pushed to target list">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
                {isBusy ? (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : (
                  <>
                    {onToggleCall && (
                      <button onClick={() => onToggleCall(p)} title={`Call status: ${callStatusLabel[p.call_status] || 'New'} — click to cycle`} className={`p-1 rounded-lg transition-colors ${p.call_status === 'connected' ? 'text-emerald-600 hover:bg-emerald-50' : p.call_status === 'attempted' ? 'text-amber-600 hover:bg-amber-50' : p.call_status === 'callback' ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onEnrich(p)} title="Re-enrich company" className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Sparkles className="w-4 h-4" />
                    </button>
                    {onFindPhone && (
                      <button onClick={() => onFindPhone(p)} title="Find a mobile number" className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                        <Smartphone className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onPush(p)} title="Push to target list" className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(p)} title="Delete prospect" className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile card layout */}
            <div className="sm:hidden px-4 py-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} onClick={(e) => handleRowClick(e, p, index)} className="mt-1" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm break-words">{p.company_name}</p>
                    <p className="text-xs text-slate-400">{[p.industry, p.employee_range, p.location].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                   {p.fit_score ? (
                     <div className="flex items-center gap-1">
                       <span className={`inline-flex items-center justify-center w-8 h-6 rounded-full text-xs font-semibold ${scoreTone(p.fit_score)}`}>{p.fit_score}</span>
                     </div>
                   ) : null}
                   <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap ${statusStyle[p.enrichment_status] || statusStyle.not_found}`}>
                     {p.enrichment_status?.replace("_", " ") || "pending"}
                   </span>
                   {hasGenericEmailOnly(p) && (
                     <span className="text-[9px] text-amber-600 leading-tight">Generic email only</span>
                   )}
                   {p.provider_error && p.enrichment_status !== 'pending' && p.enrichment_status !== 'enriching' && (
                     <button onClick={() => setDiagProspect(p)} className="text-[9px] text-slate-400 leading-tight hover:text-slate-700 transition-colors">Why no email?</button>
                   )}
                   {researchByProspect[p.id] && (
                     <button
                       type="button"
                       onClick={() => setResearchRecord(researchByProspect[p.id])}
                       className="text-[10px] text-emerald-700 underline-offset-2 hover:underline"
                     >
                       see research
                     </button>
                   )}
                 </div>
              </div>

              {p.landline && (
                <a href={`tel:${p.landline.replace(/\s+/g, '')}`} className="text-xs text-slate-600 flex items-center gap-1 hover:text-emerald-600">
                  <Phone className="w-3 h-3" /> Switchboard · {p.landline}
                </a>
              )}

              <ScreeningBadge prospect={p} />

              <button
                type="button"
                onClick={() => setNumbersOpen(numbersOpen === p.id ? null : p.id)}
                className="text-[11px] text-slate-500 hover:text-slate-800"
              >
                {numbersOpen === p.id ? "Hide number candidates" : "Number candidates"}
              </button>
              {numbersOpen === p.id && <PhoneCandidates prospect={p} onPreferred={onPhoneChange} />}

              {contacts.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {contacts.length} people · {mobileCount} mobile{mobileCount === 1 ? "" : "s"} · {emailCount} email{emailCount === 1 ? "" : "s"}
                  </p>
                  {contacts.map((c, i) => (
                    <ProspectPersonCard key={`${c.name || "person"}-${i}`} contact={c} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No decision-makers found yet — run Maximum search.</p>
              )}

              {p.call_status && p.call_status !== 'new' && (
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${callStatusStyle[p.call_status] || ''}`}>
                  {callStatusLabel[p.call_status] || p.call_status}
                </span>
              )}

              <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                {p.pushed && (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs" title="Pushed to target list">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
                {isBusy ? (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : (
                  <>
                    {onToggleCall && (
                      <button onClick={() => onToggleCall(p)} title={`Call status: ${callStatusLabel[p.call_status] || 'New'}`} className={`p-1.5 rounded-lg transition-colors ${p.call_status === 'connected' ? 'text-emerald-600 hover:bg-emerald-50' : p.call_status === 'attempted' ? 'text-amber-600 hover:bg-amber-50' : p.call_status === 'callback' ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onEnrich(p)} title="Re-enrich company" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Sparkles className="w-4 h-4" />
                    </button>
                    {onFindPhone && (
                      <button onClick={() => onFindPhone(p)} title="Find a mobile number" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                        <Smartphone className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onPush(p)} title="Push to target list" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(p)} title="Delete prospect" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {diagProspect && (
        <ProspectDiagnosticsDialog prospect={diagProspect} onClose={() => setDiagProspect(null)} />
      )}

      {researchRecord && (
        <AccountResearchDetail
          record={researchRecord}
          onClose={() => setResearchRecord(null)}
          onRecordUpdated={(next) => setResearchRecord(next)}
        />
      )}
    </div>
  );
}
