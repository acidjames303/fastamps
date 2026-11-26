import React from "react";
import { Link } from "react-router-dom";
import { Inbox, ArrowRight } from "lucide-react";

const day = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Info requests this caller raised. Each one opens the admin inbox on that
// request, so the manager lands on the account and the call behind it.
export default function SdrInfoRequestList({ items = [], callerId, canInbox }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Inbox className="w-4 h-4" /> Info requests
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{items.length}</span>
        </h2>
        {canInbox && items.length > 0 && (
          <Link to={`/manager-inbox?caller=${callerId}`} className="text-xs text-emerald-700 hover:underline">
            Open in inbox
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">No pending info requests from this caller.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const body = (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.company_name || item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {day(item.created_date)}
                    {item.campaign_name ? ` · ${item.campaign_name}` : ""}
                    {item.due_at ? ` · due ${day(item.due_at)}` : ""}
                  </p>
                  {item.description && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 whitespace-pre-wrap">{item.description}</p>
                  )}
                </div>
                {canInbox && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />}
              </div>
            );
            return canInbox ? (
              <Link
                key={item.task_id}
                to={`/manager-inbox?caller=${callerId}&task=${item.task_id}`}
                className="block px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                {body}
              </Link>
            ) : (
              <div key={item.task_id} className="px-5 py-3">{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}