import React from "react";
import { Link } from "react-router-dom";
import { Building2, ArrowRight } from "lucide-react";

const STATUS_LABEL = {
  in_progress: "In progress",
  assigned: "Assigned",
  follow_up: "Follow up",
  unassigned: "Unassigned",
  completed: "Completed",
  suppressed: "Suppressed",
  removed: "Removed",
};

const STATUS_TONE = {
  in_progress: "bg-sky-50 text-sky-700",
  assigned: "bg-slate-100 text-slate-600",
  follow_up: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
};

const at = (iso) => {
  if (!iso) return "not called yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not called yet";
  return `last called ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
};

// The accounts in this caller's book — what they have been given, where each one
// is up to, and a way into the campaign it belongs to.
export default function SdrAccountList({ accounts = [], callerId }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Accounts in their book
        </h2>
        <span className="text-[11px] text-slate-400">{accounts.length} shown</span>
      </div>
      {accounts.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">
          No accounts assigned yet. Push a campaign to them from Team to give them a book.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[24rem] overflow-y-auto">
          {accounts.map((a) => (
            <div key={a.assignment_id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-slate-900 truncate">{a.company_name}</p>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_TONE[a.status] || "bg-slate-100 text-slate-600"}`}
                >
                  {STATUS_LABEL[a.status] || a.status}
                </span>
                {a.attempts > 0 && <span className="text-[11px] text-slate-400">{a.attempts} attempts</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {at(a.last_called_at)}
                {a.campaign_id ? (
                  <>
                    {" · "}
                    <Link
                      to={`/campaigns/${a.campaign_id}/accounts?caller=${callerId}`}
                      className="text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                    >
                      {a.campaign_name || "Campaign"} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}