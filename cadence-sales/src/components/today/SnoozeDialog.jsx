import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, CalendarClock, Sun, Sunrise, Calendar } from "lucide-react";

// Snooze dialog: later today, tomorrow, next working day, or custom date+time.
export default function SnoozeDialog({ taskId, tz, onClose, onSnoozed }) {
  const [option, setOption] = useState("tomorrow");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const confirm = async () => {
    setBusy(true); setErr("");
    try {
      let due_at;
      if (option === "custom") {
        if (!customDate) { setErr("Pick a date."); setBusy(false); return; }
        due_at = new Date(`${customDate}T${customTime || "09:00"}:00`).toISOString();
      }
      const res = await base44.functions.invoke("snoozeTask", { task_id: taskId, option, due_at });
      if (res.error) { setErr(res.error); setBusy(false); return; }
      onSnoozed();
      onClose();
    } catch (e) { setErr(e.message || "Could not snooze."); }
    finally { setBusy(false); }
  };

  const opts = [
    { id: "later_today", label: "Later today", icon: Sun, desc: "+2 hours" },
    { id: "tomorrow", label: "Tomorrow", icon: Sunrise, desc: "09:00" },
    { id: "next_working_day", label: "Next working day", icon: CalendarClock, desc: "Mon–Fri" },
    { id: "custom", label: "Choose date & time", icon: Calendar, desc: "Custom" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-slate-900">Snooze task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2">
          {opts.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              onClick={() => setOption(id)}
              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                option === id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4 text-slate-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            </button>
          ))}
        </div>
        {option === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Date</label>
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Time</label>
              <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
        )}
        {err && <p className="text-sm text-rose-600 mt-3">{err}</p>}
        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onClose} className="rounded-full flex-1 border-slate-300">Cancel</Button>
          <Button onClick={confirm} disabled={busy} className="rounded-full flex-1 bg-emerald-600 hover:bg-emerald-700">
            {busy ? "Snoozing…" : "Snooze"}
          </Button>
        </div>
      </div>
    </div>
  );
}