import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";

// Inline correction of a logged call's notes — the client-facing note and the
// internal note are kept separate, exactly as they were captured.
// Older logs only have one combined notes field — open the editor with it
// already in place so nothing typed earlier has to be retyped.
const seedClientNotes = (log) => {
  const client = (log?.client_notes || "").trim();
  const internal = (log?.internal_notes || "").trim();
  const legacy = (log?.notes || "").trim();
  if (client) return client;
  if (legacy && legacy !== internal) return legacy;
  return (log?.outcome_notes || "").trim();
};

export default function CallNotesEditor({ log, onCancel, onSaved }) {
  const [clientNotes, setClientNotes] = useState(() => seedClientNotes(log));
  const [internalNotes, setInternalNotes] = useState(() => (log?.internal_notes || "").trim());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const combined = [clientNotes, internalNotes].map((n) => (n || "").trim()).filter(Boolean).join("\n\n");
      // outcome_notes is refreshed with the correction too, so every view that
      // shows the outcome note (reports, meeting prep, today results) shows the
      // corrected text instead of the old wording.
      await base44.entities.CallLog.update(log.id, {
        client_notes: clientNotes.trim(),
        internal_notes: internalNotes.trim(),
        notes: combined,
        outcome_notes: combined,
      });
      onSaved?.({ client_notes: clientNotes.trim(), internal_notes: internalNotes.trim(), notes: combined, outcome_notes: combined });
    } catch (e) {
      setError(e.message || "Could not save these notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-400">Client notes</label>
        <Textarea
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          placeholder="Client-facing note…"
          rows={8}
          className="rounded-xl bg-white border-slate-200 min-h-40 text-sm mt-1"
        />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-widest text-slate-400">Internal notes</label>
        <Textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Internal note…"
          rows={5}
          className="rounded-xl bg-slate-50 border-slate-200 min-h-28 text-sm mt-1"
        />
      </div>
      {error && <p className="text-xs text-amber-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          onClick={save}
          disabled={saving}
          className="rounded-full h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving…" : "Save notes"}
        </Button>
        <Button onClick={onCancel} variant="ghost" className="rounded-full h-8 px-3 text-xs text-slate-500">
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}