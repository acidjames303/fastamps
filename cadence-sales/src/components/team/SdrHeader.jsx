import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, LIVE_STATUS_LABEL, LIVE_STATUS_TONE } from "@/lib/roleLabels";

const when = (iso) => {
  if (!iso) return "no activity yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "no activity yet";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

// Who this caller is, what they are doing now, and the two places a manager
// carries on from: their filtered campaigns and their filtered admin inbox.
export default function SdrHeader({ caller, canInbox }) {
  const status = caller.live_status || "offline";
  return (
    <div className="space-y-4">
      <Link to="/team" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back to team
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold text-slate-900">{caller.name}</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${LIVE_STATUS_TONE[status]}`}>
              {LIVE_STATUS_LABEL[status]}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {ROLE_LABELS[caller.role] || caller.role}
            {caller.job_title ? ` · ${caller.job_title}` : ""}
            {caller.email ? ` · ${caller.email}` : ""}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {caller.activity_detail || "No live activity"} · last seen {when(caller.last_activity_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to={`/campaigns?caller=${caller.user_id}`}>
              <Layers className="w-4 h-4 mr-1.5" /> Their campaigns
            </Link>
          </Button>
          {canInbox && (
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" asChild>
              <Link to={`/manager-inbox?caller=${caller.user_id}`}>
                <Inbox className="w-4 h-4 mr-1.5" /> Their info requests
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SdrStat({ label, value, hint, tone = "text-slate-900", icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </div>
      <p className={`font-display text-2xl font-semibold mt-1 ${tone}`}>{value}</p>
      {hint ? <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p> : null}
    </div>
  );
}