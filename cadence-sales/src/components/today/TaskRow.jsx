import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Play, Check, SkipForward, Clock, ExternalLink } from "lucide-react";
import { TASK_TYPE_LABELS, PRIORITY_BAND_STYLE, formatDueTime, formatRelativeOverdue, formatLastCalled } from "@/lib/today";
import { Link, useNavigate } from "react-router-dom";
import SnoozeDialog from "./SnoozeDialog";

// One task row in the Today workspace. Shows context + priority + actions.
export default function TaskRow({ row, tz, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const task = row.task;

  const start = async () => {
    setBusy(true); setErr("");
    try {
      await base44.functions.invoke("claimTask", { task_id: task.id });
      const session = await base44.functions.invoke("prepareCallingSession", {});
      const q = (session.queue || session.data?.queue) || [];
      if (q.length) {
        const first = q[0];
        sessionStorage.setItem("calling_session", JSON.stringify(session.data || session));
        navigate(`/dialer?list=${first.target_list_id || ""}&session=true`);
      }
    } catch (e) { setErr(e.message || "Could not start."); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    setBusy(true); setErr("");
    try {
      await base44.functions.invoke("completeTask", { task_id: task.id });
      onChanged();
    } catch (e) { setErr(e.message || "Could not complete."); }
    finally { setBusy(false); }
  };

  const skip = async () => {
    if (!skipReason.trim()) return;
    setBusy(true); setErr("");
    try {
      await base44.functions.invoke("updateTask", { task_id: task.id, status: "skipped", skip_reason: skipReason.trim() });
      setShowSkip(false); setSkipReason("");
      onChanged();
    } catch (e) { setErr(e.message || "Could not skip."); }
    finally { setBusy(false); }
  };

  const assignment = task.assigned_user_id
    ? (row.assigned_to_me ? "Assigned to me" : "Assigned")
    : "Unassigned";

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_BAND_STYLE[row.priority_band] || PRIORITY_BAND_STYLE.normal}`}>
              {row.priority_band} · {row.priority_score}
            </span>
            <span className="text-xs text-slate-500">{TASK_TYPE_LABELS[task.task_type] || task.task_type}</span>
            {task.due_at && (
              <span className="text-xs text-slate-400">
                {formatRelativeOverdue(task.due_at, tz) || formatDueTime(task.due_at, tz)}
              </span>
            )}
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{assignment}</span>
          </div>

          <p className="font-medium text-slate-900 mt-1.5 truncate">
            {row.company?.name || row.contact?.company || task.title || "Untitled task"}
          </p>
          <p className="text-sm text-slate-500 truncate">
            {row.contact?.full_name || "—"}{row.contact?.job_title ? ` · ${row.contact.job_title}` : ""}
          </p>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            {row.list && <span>{row.list.name}</span>}
            {row.phone && <span>· {row.best_number_type === "direct" ? "Direct" : row.best_number_type === "switchboard" ? "Switchboard" : "Number"}: {row.phone}</span>}
            <span>· Last: {formatLastCalled(row.last_called, tz)}</span>
          </div>

          {row.priority_reason && (
            <p className="text-xs text-slate-400 mt-1 italic">{row.priority_reason}</p>
          )}
          {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          {(task.task_type === "new_call" || task.task_type === "callback" || task.task_type === "follow_up" || task.task_type === "revisit") && (
            <Button onClick={start} disabled={busy} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-8 px-3">
              <Play className="w-3 h-3 mr-1" /> Call
            </Button>
          )}
          {row.company && (
            <Link to={`/prospecting`} className="inline-flex">
              <Button variant="ghost" size="sm" className="rounded-full h-8 px-3 text-slate-400 hover:text-slate-600">
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <Button onClick={complete} disabled={busy} variant="ghost" size="sm" className="rounded-full h-7 px-2.5 text-emerald-600 hover:bg-emerald-50">
          <Check className="w-3 h-3 mr-1" /> Complete
        </Button>
        <Button onClick={() => setShowSkip(!showSkip)} variant="ghost" size="sm" className="rounded-full h-7 px-2.5 text-slate-400 hover:bg-slate-50">
          <SkipForward className="w-3 h-3 mr-1" /> Skip
        </Button>
        <SnoozeButton taskId={task.id} tz={tz} onChanged={onChanged} />
      </div>

      {showSkip && (
        <div className="mt-2 flex gap-2">
          <input
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Reason for skipping (required)"
            className="flex-1 rounded-lg border border-slate-200 bg-white text-slate-900 px-3 py-1.5 text-sm placeholder:text-slate-400"
            autoFocus
          />
          <Button onClick={skip} disabled={busy || !skipReason.trim()} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-8">
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
}

function SnoozeButton({ taskId, tz, onChanged }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="ghost" size="sm" className="rounded-full h-7 px-2.5 text-slate-400 hover:bg-slate-50">
        <Clock className="w-3 h-3 mr-1" /> Snooze
      </Button>
      {open && (
        <SnoozeDialog taskId={taskId} tz={tz} onClose={() => setOpen(false)} onSnoozed={onChanged} />
      )}
    </>
  );
}