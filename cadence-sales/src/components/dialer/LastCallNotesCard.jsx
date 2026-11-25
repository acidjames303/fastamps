import React, { useState } from "react";
import { Pencil, X } from "lucide-react";
import CallNotesEditor from "@/components/calls/CallNotesEditor";

// The call just logged — lets the caller correct its notes straight away.
export default function LastCallNotesCard({ log: initialLog, onDismiss }) {
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState(initialLog);
  const notes = log?.notes || "";

  if (!log) return null;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          Notes saved{log.contact_name ? ` for ${log.contact_name}` : ""}
        </p>
        <div className="flex items-center gap-3">
          {!editing && (
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
            onClick={onDismiss}
            className="text-slate-300 hover:text-slate-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3">
          <CallNotesEditor
            log={log}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setLog((prev) => ({ ...prev, ...updated }));
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <p className={`mt-2 text-sm whitespace-pre-line ${notes ? "text-slate-600" : "text-slate-300 italic"}`}>
          {notes || "No notes recorded"}
        </p>
      )}
    </div>
  );
}