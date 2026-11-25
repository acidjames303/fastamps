import React from "react";
import { MessageSquare, Clock, TrendingUp } from "lucide-react";
import { getOutcomeLabel } from "@/lib/outcomeRules";

// Caller day flow: who spoken to, who needs follow-up, which calls went better.
export default function DayFlow({ dayFlow }) {
  if (!dayFlow) return null;
  const spoken = dayFlow.spoken_today || [];
  const followUps = dayFlow.needs_follow_up || [];
  const better = dayFlow.better_calls || [];
  if (!spoken.length && !followUps.length && !better.length) return null;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Panel
        icon={MessageSquare}
        title="Spoken to today"
        empty="No conversations logged yet today."
        tone="text-sky-600"
      >
        {spoken.map((row) => (
          <Row
            key={row.call_log_id}
            title={`${row.contact_name || "Contact"} · ${row.company || "—"}`}
            meta={`${row.who_spoken_to} · ${getOutcomeLabel(row.outcome) || row.outcome || "—"}`}
            detail={row.notes}
          />
        ))}
      </Panel>

      <Panel
        icon={Clock}
        title="Needs following up"
        empty="Nothing waiting on a follow-up."
        tone="text-amber-600"
      >
        {followUps.map((row) => (
          <Row
            key={row.task_id}
            title={`${row.contact_name || "Contact"} · ${row.company || "—"}`}
            meta={row.reason}
            detail={row.due_at ? `Due ${new Date(row.due_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}` : ""}
          />
        ))}
      </Panel>

      <Panel
        icon={TrendingUp}
        title="Better calls today"
        empty="Conversations will rank here as you log outcomes."
        tone="text-emerald-600"
      >
        {better.map((row, i) => (
          <Row
            key={row.call_log_id}
            title={`${i + 1}. ${row.contact_name || "Contact"} · ${row.company || "—"}`}
            meta={`${getOutcomeLabel(row.outcome) || row.outcome || "—"} · ${row.who_spoken_to}`}
            detail={row.next_step ? `Next: ${row.next_step}${row.next_step_date ? ` · ${row.next_step_date}` : ""}` : row.notes}
          />
        ))}
      </Panel>
    </div>
  );
}

function Panel({ icon: Icon, title, empty, tone, children }) {
  const items = React.Children.toArray(children);
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone}`} />
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 p-4">{empty}</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">{items}</div>
      )}
    </div>
  );
}

function Row({ title, meta, detail }) {
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 truncate">{meta}</p>
      {detail ? <p className="text-xs text-slate-400 mt-1 line-clamp-2 whitespace-pre-wrap">{detail}</p> : null}
    </div>
  );
}
