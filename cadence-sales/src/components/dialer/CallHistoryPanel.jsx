import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Calendar, Loader2, Pencil } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canEditCallNotes } from "@/lib/notePermissions";
import CallNotesEditor from "@/components/calls/CallNotesEditor";

// Shows previous call notes for the whole account (the selected contact's
// history plus every other contact at the same company) so a caller has full
// context in front of them during the call.
export default function CallHistoryPanel({ contact, company }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState("");

  const handleSaved = (logId, updated) => {
    setLogs((prev) => (prev || []).map((l) => (l.id === logId ? { ...l, ...updated } : l)));
    setEditingId("");
  };

  useEffect(() => {
    if (!contact?.id && !company?.id) { setLogs([]); return; }
    let alive = true;
    setLoading(true);
    const queries = [];
    if (contact?.id) queries.push(base44.entities.CallLog.filter({ contact_id: contact.id }, "-created_date", 40));
    if (company?.id) queries.push(base44.entities.CallLog.filter({ company_id: company.id }, "-created_date", 40));
    Promise.all(queries.map((q) => q.catch(() => [])))
      .then((results) => {
        if (!alive) return;
        const byId = new Map();
        results.flat().forEach((log) => { if (log?.id) byId.set(log.id, log); });
        const merged = [...byId.values()]
          .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
          .slice(0, 30);
        setLogs(merged);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [contact?.id, company?.id]);

  if (!contact && !company) return null;

  const hasHistory = logs && logs.length > 0;
  // While a note is being edited the list is not height-clamped, so the whole
  // note and the save controls stay reachable.
  const listClass = editingId
    ? "space-y-3 overflow-y-auto"
    : "space-y-3 overflow-y-auto max-h-96";

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Account note history
        </p>
        {hasHistory && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">
            {logs.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
        </div>
      ) : hasHistory ? (
        <div className={listClass}>
          {logs.map((log) => {
            const isThisContact = !!contact?.id && log.contact_id === contact.id;
            return (
              <div
                key={log.id}
                className={`border-l-2 pl-3 ${isThisContact ? "border-emerald-400" : "border-slate-100"}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
                  <Calendar className="w-3 h-3" />
                  {log.created_date
                    ? new Date(log.created_date).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                  {log.contact_name && (
                    <span className={`font-medium ${isThisContact ? "text-emerald-700" : "text-slate-600"}`}>
                      {log.contact_name}
                    </span>
                  )}
                  {log.outcome && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">
                      {log.outcome.replace(/_/g, " ")}
                    </span>
                  )}
                  {editingId !== log.id && canEditCallNotes({ appRole: user?.app_role, userId: user?.id, log }) && (
                    <button
                      type="button"
                      onClick={() => setEditingId(log.id)}
                      className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-700"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
                {editingId === log.id ? (
                  <CallNotesEditor
                    log={log}
                    onCancel={() => setEditingId("")}
                    onSaved={(updated) => handleSaved(log.id, updated)}
                  />
                ) : log.notes ? (
                  <p className="text-sm text-slate-700 whitespace-pre-line">{log.notes}</p>
                ) : (
                  <p className="text-sm text-slate-300 italic">No notes recorded</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No call notes recorded for this account yet.</p>
      )}
    </div>
  );
}