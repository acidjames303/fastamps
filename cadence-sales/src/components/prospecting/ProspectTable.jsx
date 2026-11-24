import React, { useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Smartphone, User, Sparkles, ArrowRight, Trash2, Loader2, Check, Mail, PhoneCall, BadgeCheck } from "lucide-react";
import ProspectDiagnosticsDialog from "./ProspectDiagnosticsDialog";
import AccountResearchDetail from "./AccountResearchDetail";

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
  if (!p.email) return false;
  if (p.email_type === "personal_work") return false;
  if (p.email_type === "generic_company" || p.email_type === "role_based_work") return true;
  if (p.generic_email && p.email === p.generic_email) return true;
  return false;
}

function scoreTone(s) {
  if (s >= 75) return "bg-emerald-600 text-white";
  if (s >= 50) return "bg-amber-500 text-white";
  return "bg-slate-300 text-slate-700";
}

export default function ProspectTable({ prospects, selected, setSelected, onEnrich, onPush, onDelete, onToggleCall, onFindPhone, busyId, researchByProspect = {} }) {
  const [open, setOpen] = useState(null);
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
    <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
      {/* Desktop table header */}
      <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
        <span className="col-span-1 flex items-center"><Checkbox checked={all} onCheckedChange={toggleAll} /></span>
        <span className="col-span-3">Company</span>
        <span className="col-span-2">Decision-makers</span>
        <span className="col-span-2">Number</span>
        <span className="col-span-1">Fit</span>
        <span className="col-span-1">Status</span>
        <span className="col-span-2 text-right">Actions</span>
      </div>
      {prospects.map((p, index) => {
        const contacts = p.contacts || [];
        const shown = contacts.slice(0, 2);
        const extra = contacts.length - shown.length;
        const hasMobile = p.phone && p.landline && p.phone !== p.landline;
        const isBusy = busyId === p.id;
        return (
          <div key={p.id} className="border-t border-slate-100">
            {/* Desktop grid row */}
            <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 items-start text-sm">
              <span className="col-span-1 pt-1"><Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} onClick={(e) => handleRowClick(e, p, index)} /></span>
              <div className="col-span-3">
                <p className="font-medium text-slate-900">{p.company_name}</p>
                <p className="text-xs text-slate-400">{[p.industry, p.employee_range, p.location].filter(Boolean).join(" · ")}</p>
                {p.landline && (
                  <a href={`tel:${p.landline.replace(/\s+/g, '')}`} className="text-xs text-slate-600 mt-1 flex items-center gap-1 hover:text-emerald-600"><Phone className="w-3 h-3" /> {p.landline}</a>
                )}
                {p.call_status && p.call_status !== 'new' && (
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border mt-1 ${callStatusStyle[p.call_status] || ''}`}>
                    {callStatusLabel[p.call_status] || p.call_status}
                  </span>
                )}
              </div>
              <div className="col-span-2">
                {contacts.length === 0 ? (
                  <p className="text-slate-300">No decision-makers found</p>
                ) : (
                  <div className="space-y-1">
                    {shown.map((c, i) => (
                      <div key={i} className="space-y-0.5">
                        <p className="text-slate-800">
                          <span className="font-medium">{c.name}</span>
                          {c.title ? <span className="text-slate-400"> — {c.title}</span> : null}
                          {c.phone ? <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="text-emerald-600 ml-1.5 text-xs hover:underline">· {c.phone}</a> : null}
                        </p>
                        {c.email && (
                          <a href={`mailto:${c.email}?subject=Following up from our call`} className="block text-xs text-blue-600 hover:underline">
                            <Mail className="w-3 h-3 inline mr-0.5" /> {c.email}
                            {c.email_status === "verified" && <BadgeCheck className="w-3 h-3 inline ml-0.5 text-emerald-600" />}
                            {c.email_status === "inferred" && <span className="ml-1 text-amber-600 no-underline">· inferred, unverified</span>}
                          </a>
                        )}
                      </div>
                    ))}
                    {extra > 0 && (
                      <button onClick={() => setOpen(open === p.id ? null : p.id)} className="text-xs text-slate-500 hover:text-slate-800">
                        {open === p.id ? "Hide" : `+${extra} more`}
                      </button>
                    )}
                    {open === p.id && (
                      <div className="pt-1 space-y-0.5">
                        {contacts.slice(2).map((c, i) => (
                          <div key={i} className="space-y-0.5">
                            <p className="text-slate-700 text-xs">
                              <span className="font-medium">{c.name}</span>
                              {c.title ? <span className="text-slate-400"> — {c.title}</span> : null}
                              {c.phone ? <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="text-emerald-600 ml-1 hover:underline">· {c.phone}</a> : null}
                            </p>
                            {c.email && (
                              <a href={`mailto:${c.email}`} className="block text-xs text-blue-600 hover:underline">
                                <Mail className="w-3 h-3 inline mr-0.5" /> {c.email}
                                {c.email_status === "verified" && <BadgeCheck className="w-3 h-3 inline ml-0.5 text-emerald-600" />}
                                {c.email_status === "inferred" && <span className="ml-1 text-amber-600 no-underline">· inferred, unverified</span>}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-0.5 pt-0.5">
                {hasMobile ? (
                  <>
                    <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="text-xs text-slate-800 flex items-center gap-1 hover:text-emerald-600"><Smartphone className="w-3 h-3 text-emerald-600" /> {p.phone}</a>
                    <a href={`tel:${p.landline.replace(/\s+/g, '')}`} className="text-xs text-slate-500 flex items-center gap-1 hover:text-emerald-600"><Phone className="w-3 h-3" /> {p.landline}</a>
                  </>
                ) : (
                  p.phone ? (
                    <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="text-slate-700 font-mono text-xs flex items-center gap-1 hover:text-emerald-600">
                      <Phone className="w-3 h-3" /> {p.phone}
                    </a>
                  ) : (
                    <p className="text-slate-300 font-mono text-xs flex items-center gap-1">
                      <User className="w-3 h-3" /> —
                    </p>
                  )
                )}
              </div>
              <span className="col-span-1 pt-0.5">
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
                ) : "—"}
              </span>
              <span className="col-span-1 pt-0.5">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusStyle[p.enrichment_status] || statusStyle.not_found}`}>
                  {p.enrichment_status?.replace("_", " ") || "pending"}
                </span>
                {hasGenericEmailOnly(p) && (
                  <span className="block text-[10px] text-amber-600 mt-1 leading-tight" title="This record only has a generic company inbox — a personal work email is still needed">
                    Generic email only
                  </span>
                )}
                {p.provider_error && p.enrichment_status !== 'pending' && p.enrichment_status !== 'enriching' && (
                  <button onClick={() => setDiagProspect(p)} className="block text-[10px] text-slate-400 mt-1 leading-tight hover:text-slate-700 transition-colors">
                    Why no email? →
                  </button>
                )}
              </span>
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
                  <Phone className="w-3 h-3" /> {p.landline}
                </a>
              )}

              {contacts.length > 0 && (
                <div className="space-y-1.5">
                  {contacts.map((c, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-xs text-slate-800">
                        <span className="font-medium">{c.name}</span>
                        {c.title ? <span className="text-slate-400"> — {c.title}</span> : null}
                      </p>
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="text-xs text-emerald-600 flex items-center gap-1 hover:underline">
                          <Smartphone className="w-3 h-3" /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}?subject=Following up from our call`} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                          <Mail className="w-3 h-3" /> {c.email}
                          {c.email_status === "verified" && <BadgeCheck className="w-3 h-3 text-emerald-600" />}
                          {c.email_status === "inferred" && <span className="text-amber-600">· inferred, unverified</span>}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!p.landline && contacts.length === 0 && (
                <p className="text-xs text-slate-300">No contact details found yet.</p>
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

      <AccountResearchDetail record={researchRecord} onClose={() => setResearchRecord(null)} />
    </div>
  );
}