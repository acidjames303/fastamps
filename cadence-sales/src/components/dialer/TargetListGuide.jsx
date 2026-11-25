import React, { useState } from "react";
import { Megaphone, MessageSquare, HelpCircle, Shield, ChevronDown, ChevronUp } from "lucide-react";

// Shows the active Target List's call guidance in the Dialer so the rep has
// the offer, opener, talking points, qualification questions and objection
// handling right next to the company brief.
export default function TargetListGuide({ targetList }) {
  const [open, setOpen] = useState(false);
  if (!targetList) return null;
  const hasGuide = targetList.offer || targetList.call_opener || targetList.talking_points ||
    targetList.qualification_questions || targetList.objection_guidance;
  if (!hasGuide) return null;

  return (
    <div className="rounded-3xl bg-slate-900 text-white p-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-400">
          <Megaphone className="w-3.5 h-3.5" /> {targetList.name}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="mt-4 space-y-4 text-sm">
          {targetList.offer && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Offer</p>
              <p className="text-slate-200 leading-relaxed">{targetList.offer}</p>
            </div>
          )}
          {targetList.call_opener && (
            <div className="flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-slate-200 italic">“{targetList.call_opener}”</p>
            </div>
          )}
          {targetList.talking_points && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Talking points</p>
              <p className="text-slate-300 whitespace-pre-line leading-relaxed">{targetList.talking_points}</p>
            </div>
          )}
          {targetList.qualification_questions && (
            <div className="flex items-start gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-slate-300 whitespace-pre-line leading-relaxed">{targetList.qualification_questions}</p>
            </div>
          )}
          {targetList.objection_guidance && (
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-slate-300 whitespace-pre-line leading-relaxed">{targetList.objection_guidance}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}