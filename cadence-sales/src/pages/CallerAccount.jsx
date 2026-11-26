import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, Phone, PhoneCall, Target, Clock, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import SdrHeader, { SdrStat } from "@/components/team/SdrHeader";
import SdrWeekStrip from "@/components/team/SdrWeekStrip";
import SdrCallsList from "@/components/team/SdrCallsList";
import SdrCampaignList from "@/components/team/SdrCampaignList";
import SdrAccountList from "@/components/team/SdrAccountList";
import SdrInfoRequestList from "@/components/team/SdrInfoRequestList";

const Figure = ({ label, value, tone = "text-slate-900", icon: Icon }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span className="text-slate-500 inline-flex items-center gap-1">
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {label}
    </span>
    <span className={`font-medium ${tone}`}>{value}</span>
  </div>
);

// One caller's account: everything a manager needs to see what that person is
// doing, who they are calling and what is waiting on them — with the way into
// their filtered campaigns and their filtered admin inbox.
export default function CallerAccount() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canInbox = ["platform_owner", "organisation_admin"].includes(user?.app_role);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("getSdrAccount", { user_id: userId, profile_id: userId });
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not load this account.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  if (loading && !data) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error && !data) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">This team member's account could not be loaded.</p>;

  const { caller, stats, daily, campaigns, accounts, info_requests: infoRequests, calls } = data;
  const target = caller.daily_call_target || 0;
  const targetPct = target ? Math.min(100, Math.round((stats.callsToday / target) * 100)) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SdrHeader caller={caller} canInbox={canInbox} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SdrStat
          label="Calls today"
          value={target ? `${stats.callsToday}/${target}` : stats.callsToday}
          hint={target ? `${targetPct}% of daily target` : "no daily target set"}
          icon={Phone}
          tone="text-emerald-700"
        />
        <SdrStat
          label="Conversations today"
          value={stats.conversationsToday}
          hint={`${stats.callsToday} calls logged`}
          icon={PhoneCall}
        />
        <SdrStat
          label="Connect rate · 7 days"
          value={`${stats.connectRate7d}%`}
          hint={`${stats.conversations7d} of ${stats.calls7d} calls`}
          icon={Target}
        />
        <SdrStat
          label="Interested · 30 days"
          value={stats.interested30d}
          hint={`${stats.calls30d} calls in 30 days`}
          icon={Phone}
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="space-y-5">
          <SdrWeekStrip daily={daily} />

          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Workload</h2>
              <Button variant="ghost" size="sm" className="rounded-full text-xs text-slate-500" onClick={load} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            <Figure label="Accounts assigned" value={stats.assignedAccounts} />
            <Figure label="Accounts completed" value={`${stats.completedAccounts} / ${stats.assignedAccounts}`} />
            <Figure label="Open tasks" value={stats.openTasks} />
            <Figure label="Overdue" value={stats.overdue} tone={stats.overdue ? "text-rose-600" : "text-slate-900"} icon={Clock} />
            <Figure label="Due today" value={stats.dueToday} icon={ListChecks} />
          </div>

          <SdrAccountList accounts={accounts || []} callerId={caller.user_id} />

          <SdrCampaignList campaigns={campaigns} callerId={caller.user_id} />
        </div>

        <div className="space-y-5">
          <SdrInfoRequestList items={infoRequests} callerId={caller.user_id} canInbox={canInbox} />
          <SdrCallsList calls={calls} />
        </div>
      </div>
    </div>
  );
}