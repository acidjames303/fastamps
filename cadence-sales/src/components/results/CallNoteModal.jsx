import React, { useState } from "react";
import { X, Pencil } from "lucide-react";
import { getOutcomeLabel, isConversation } from "@/lib/outcomeRules";
import { clientSafeNotes, clientSafeDate } from "@/lib/reportMetrics";
import { useAuth } from "@/lib/AuthContext";
import { canEditCallNotes } from "@/lib/notePermissions";
import CallNotesEditor from "@/components/calls/CallNotesEditor";

// Shows call notes for a CallLog — client notes separate from internal/AI scratch.
export default function CallNoteModal({ call, onClose, onSaved }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  if (!call) return null;
  const clientNote = clientSafeNotes(call);
  const internalNote = (call.internal_notes || "").trim();
  const date = clientSafeDate(call) || "—";
  const canEdit = canEditCallNotes({ appRole: user?.app_role, userId: user?.id, log: call });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">{call.contact_name || "Unknown contact"}</h3>
            <p className="text-sm text-slate-500">{call.company || "—"}{call.phone ? ` · ${call.phone}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit notes
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {getOutcomeLabel(call.primary_outcome || "other")}
            </span>
            {isConversation(call) && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {call.conversation_type === "gatekeeper" ? "Gatekeeper" : call.conversation_type === "wrong_person" ? "Wrong person" : call.conversation_type === "other" ? "Other" : "Decision-maker"}
              </span>
            )}
            {call.info_request_topic && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {call.info_request_topic}
              </span>
            )}
            {call.is_info_recall && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                IR recall
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">{date}</span>
          </div>

          {(call.territory || call.account_manager_name) && (
            <p className="text-xs text-slate-500">
              {[call.territory, call.account_manager_name].filter(Boolean).join(" · ")}
              {call.account_manager_email ? ` · ${call.account_manager_email}` : ""}
            </p>
          )}

          {editing ? (
            <CallNotesEditor
              log={call}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => { onSaved?.(updated); setEditing(false); }}
            />
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-1.5">Client notes</p>
                {clientNote ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{clientNote}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No client-facing note for this call.</p>
                )}
              </div>

              {internalNote && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-1.5">Internal notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {internalNote}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}