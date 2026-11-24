import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PhoneCall, Phone, MessageSquare, TrendingUp, NotebookPen, Building2, Clock } from "lucide-react";

const FILTERS = {
  completed: { label: "Calls completed", icon: PhoneCall, tone: "text-slate-900" },
  answered: { label: "Calls answered", icon: Phone, tone: "text-emerald-600" },
  conversations: { label: "Conversations", icon: MessageSquare, tone: "text-sky-600" },
  interested: { label: "Interested", icon: TrendingUp, tone: "text-amber-600" },
};

const OUTCOME_TONES = {
  connected_interested: "bg-amber-50 text-amber-700",
  connected_callback: "bg-sky-50 text-sky-700",
  connected_not_interested: "bg-rose-50 text-rose-700",
  connected_qualified: "bg-emerald-50 text-emerald-700",
  connected_information_requested: "bg-indigo-50 text-indigo-700",
  no_answer: "bg-slate-100 text-slate-500",
  voicemail: "bg-slate-100 text-slate-500",
  busy: "bg-slate-100 text-slate-500",
  gatekeeper: "bg-slate-100 text-slate-500",
};

const label = (s) => (s || "").replace(/_/g, " ");

function isToday(iso, tz) {
  if (!iso) return false;
  try {
    const d = new Date(iso);
    const now = new Date();
    return d.toLocaleDateString("en-GB", { timeZone: tz }) === now.toLocaleDateString("en-GB", { timeZone: tz });
  } catch {
    return false;
  }
}

function matchesFilter(log, filter) {
  switch (filter) {
    case "answered":
      return log.call_connected === true;
    case "conversations":
      return log.conversation_held === true;
    case "interested":
      return (
        log.primary_outcome === "connected_interested" ||
        log.primary_outcome === "connected_qualified" ||
        log.outcome === "interested" ||
        log.qualification_status === "qualified"
      );
    default:
      return true;
  }
}

export default function TodayResultsModal({ open, onClose, user, filter }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);

  const isManager = ["platform_owner", "organisation_admin", "sales_manager"].includes(user?.app_role);
  const cfg = FILTERS[filter] || FILTERS.completed;

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const query = isManager
          ? { organisation_id: user.organisation_id }
          : { user_id: user.id };
        const list = await base44.entities.CallLog.filter(query, "-started_date", 100);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
        setLogs((list || []).filter((l) => isToday(l.started_at || l.created_date, tz) && matchesFilter(l, filter)));
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user?.id, isManager, user?.organisation_id, filter]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <cfg.icon className={`w-5 h-5 ${cfg.tone}`} />
            {cfg.label} — today
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : (logs || []).length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No call results yet today.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => {
              const note = l.notes || l.outcome_notes;
              const time = l.started_at || l.created_date;
              return (
                <div key={l.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        {l.company || l.contact_name || "Unknown"}
                      </p>
                      {l.contact_name && l.company && (
                        <p className="text-xs text-slate-500 mt-0.5">{l.contact_name}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${OUTCOME_TONES[l.primary_outcome] || "bg-slate-100 text-slate-500"}`}>
                      {label(l.primary_outcome || l.outcome)}
                    </span>
                  </div>

                  {time && (
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(time).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      {l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)}m` : ""}
                    </p>
                  )}

                  {note && (
                    <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                        <NotebookPen className="w-3.5 h-3.5" /> Notes
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{note}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}