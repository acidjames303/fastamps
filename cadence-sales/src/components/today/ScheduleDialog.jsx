import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, CalendarClock } from "lucide-react";

// Schedule a callback reminder for a contact that has no active task.
// Creates a callback Task with the chosen due date/time.
export default function ScheduleDialog({ contact, company, onClose, onScheduled }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const confirm = async () => {
    if (!date) { setErr("Pick a date."); return; }
    setBusy(true); setErr("");
    try {
      const due_at = new Date(`${date}T${time || "09:00"}:00`).toISOString();
      await base44.functions.invoke("createTask", {
        task_type: "callback",
        contact_id: contact.id,
        company_id: company?.id || "",
        due_at,
        title: `Callback · ${contact.full_name}`,
        source: "manual",
      });
      onScheduled();
      onClose();
    } catch (e) {
      setErr(e.message || "Could not schedule.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-slate-900">Schedule reminder</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          {contact.full_name}{company?.name ? ` · ${company.name}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>
        {err && <p className="text-sm text-rose-600 mt-3">{err}</p>}
        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onClose} className="rounded-full flex-1 border-slate-300">Cancel</Button>
          <Button onClick={confirm} disabled={busy} className="rounded-full flex-1 bg-emerald-600 hover:bg-emerald-700">
            <CalendarClock className="w-4 h-4 mr-1.5" /> {busy ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}