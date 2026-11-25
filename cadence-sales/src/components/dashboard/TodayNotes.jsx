import React from "react";
import { Button } from "@/components/ui/button";
import { Download, StickyNote } from "lucide-react";

export default function TodayNotes({ logs, contacts = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((l) => (l.created_date || "").slice(0, 10) === today);
  const freqByContact = {};
  contacts.forEach((c) => { freqByContact[c.id] = c.call_count || 0; });

  const exportToday = () => {
    const rows = [["Contact", "Company", "Phone", "Date", "Times called", "Outcome", "Notes"]];
    todayLogs.forEach((l) =>
      rows.push([
        l.contact_name, l.company, l.phone,
        (l.created_date || "").slice(0, 10),
        freqByContact[l.contact_id] || 0,
        l.outcome, l.notes,
      ])
    );
    const csv = rows.map((r) => r.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `todays-calls-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Today's notes</h2>
          <p className="text-xs text-slate-400 mt-0.5">{todayLogs.length} call{todayLogs.length === 1 ? "" : "s"} logged today.</p>
        </div>
        <Button variant="outline" onClick={exportToday} disabled={todayLogs.length === 0} className="rounded-full border-slate-300">
          <Download className="w-4 h-4 mr-2" /> Export today's calls
        </Button>
      </div>
      {todayLogs.length === 0 ? (
        <p className="px-6 py-10 text-slate-400 text-sm flex items-center gap-2">
          <StickyNote className="w-4 h-4" /> No calls logged yet today — notes you add in the dialer will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {todayLogs.map((l) => (
            <li key={l.id} className="px-6 py-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-slate-900">{l.contact_name}</p>
                <span className="text-xs uppercase tracking-widest text-slate-400">{l.outcome.replace(/_/g, " ")}</span>
              </div>
              {l.notes ? (
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{l.notes}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">No note recorded.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}