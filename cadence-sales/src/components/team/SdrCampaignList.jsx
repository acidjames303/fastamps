import React from "react";
import { Link } from "react-router-dom";
import { Layers, ArrowRight } from "lucide-react";

// The campaigns this caller carries, with how much of each they have worked.
export default function SdrCampaignList({ campaigns = [], callerId }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4" /> Campaigns they carry
        </h2>
        <Link to={`/campaigns?caller=${callerId}`} className="text-xs text-emerald-700 hover:underline">
          Filter campaigns
        </Link>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">No campaign pushed to them yet. Push one from Team or Campaigns.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {campaigns.map((c) => {
            const pct = c.assigned ? Math.round((c.completed / c.assigned) * 100) : 0;
            return (
              <div key={c.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.assigned} accounts · {c.completed} done · {c.calls} calls · {c.conversations} conversations
                    </p>
                  </div>
                  <Link
                    to={`/campaigns/${c.id}/accounts`}
                    className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    Accounts <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}