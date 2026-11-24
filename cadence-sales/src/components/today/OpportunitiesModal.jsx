import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Target, Building2, User, PoundSterling, CalendarClock, NotebookPen } from "lucide-react";

const STAGE_TONES = {
  discovered: "bg-slate-100 text-slate-600",
  qualifying: "bg-sky-50 text-sky-700",
  qualified: "bg-emerald-50 text-emerald-700",
  meeting_proposed: "bg-amber-50 text-amber-700",
  meeting_booked: "bg-violet-50 text-violet-700",
  handoff_ready: "bg-indigo-50 text-indigo-700",
  handed_off: "bg-slate-100 text-slate-500",
  closed_won: "bg-emerald-100 text-emerald-700",
  closed_lost: "bg-rose-50 text-rose-700",
};

const label = (s) => (s || "").replace(/_/g, " ");

export default function OpportunitiesModal({ open, onClose, user }) {
  const [opps, setOpps] = useState(null);
  const [callLogs, setCallLogs] = useState({});
  const [nameMap, setNameMap] = useState({});
  const [loading, setLoading] = useState(true);

  const isManager = ["platform_owner", "organisation_admin", "sales_manager"].includes(user?.app_role);

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const filter = isManager
          ? { organisation_id: user.organisation_id }
          : { owner_user_id: user.id };
        const list = await base44.entities.Opportunity.filter(filter, "-created_date", 100);
        setOpps(list || []);

        // Fetch the source call notes ("what they said") in parallel.
        const logIds = [...new Set((list || []).map((o) => o.source_call_log_id).filter(Boolean))];
        const logs = await Promise.all(logIds.map((id) => base44.entities.CallLog.get(id).catch(() => null)));
        const logMap = {};
        logs.filter(Boolean).forEach((cl) => { logMap[cl.id] = cl; });
        setCallLogs(logMap);

        // For the BDM view, resolve SDR names so results are grouped by profile.
        if (isManager) {
          const profiles = await base44.entities.UserProfile.filter({ organisation_id: user.organisation_id }).catch(() => []);
          const nm = {};
          (profiles || []).forEach((p) => { nm[p.user_id] = p.full_name || p.email || "SDR"; });
          setNameMap(nm);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user?.id, isManager, user?.organisation_id]);

  // Group opportunities by the SDR who owns them (manager view).
  const grouped = {};
  (opps || []).forEach((o) => {
    const key = o.owner_user_id || "unassigned";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  });
  const ownerKeys = Object.keys(grouped);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Target className="w-5 h-5 text-violet-600" />
            {isManager ? "Team opportunities" : "My opportunities"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : (opps || []).length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No opportunities yet. Qualified call outcomes will appear here.</p>
        ) : (
          <div className="space-y-6">
            {ownerKeys.map((ownerId) => (
              <div key={ownerId}>
                {isManager && (
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700">
                      {nameMap[ownerId] || "Unassigned"}
                    </h3>
                    <span className="text-xs text-slate-400">· {grouped[ownerId].length} opportunit{grouped[ownerId].length === 1 ? "y" : "ies"}</span>
                  </div>
                )}
                <div className="space-y-3">
                  {grouped[ownerId].map((o) => {
                    const sourceLog = o.source_call_log_id ? callLogs[o.source_call_log_id] : null;
                    return (
                      <div key={o.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-slate-400 shrink-0" /> {o.name || "Opportunity"}
                            </p>
                            {o.next_step && (
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <CalendarClock className="w-3.5 h-3.5" /> Next: {o.next_step}
                                {o.next_step_at ? ` · ${new Date(o.next_step_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_TONES[o.stage] || STAGE_TONES.discovered}`}>{label(o.stage)}</span>
                            {!!o.estimated_value && (
                              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                <PoundSterling className="w-3 h-3" /> {Number(o.estimated_value).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Qualification — what they said */}
                        <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                          {o.need_summary && <Field label="Need" value={o.need_summary} />}
                          {o.pain_points && <Field label="Pain" value={o.pain_points} />}
                          {o.current_solution && <Field label="Today" value={o.current_solution} />}
                          {o.timing && <Field label="Timing" value={o.timing} />}
                          {o.budget_status && <Field label="Budget" value={o.budget_status} />}
                          {o.decision_makers && <Field label="Decision makers" value={o.decision_makers} />}
                          {o.decision_process && <Field label="Decision process" value={o.decision_process} />}
                        </div>

                        {/* Source call notes */}
                        {sourceLog && (sourceLog.notes || sourceLog.outcome_notes) && (
                          <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3">
                            <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                              <NotebookPen className="w-3.5 h-3.5" /> What they said
                            </p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{sourceLog.notes || sourceLog.outcome_notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label: l, value }) {
  return (
    <div>
      <span className="text-xs text-slate-400">{l}: </span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}