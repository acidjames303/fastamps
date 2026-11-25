import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Building2, Phone, MessageSquare, UserCheck, AlertTriangle, Clock, Users, RefreshCw } from "lucide-react";
import DataReadinessPanel from "@/components/campaigns/DataReadinessPanel";
import ReviewQueuePanel from "@/components/campaigns/ReviewQueuePanel";
import CampaignExportButton from '@/components/campaigns/CampaignExportButton';
import CampaignBriefEditor from '@/components/campaigns/CampaignBriefEditor';

const STATUS_LABELS = {
  draft: "Draft", ready: "Ready", active: "Active", paused: "Paused", completed: "Completed", archived: "Archived",
};
const STATUS_TONES = {
  draft: "bg-slate-100 text-slate-600", ready: "bg-blue-50 text-blue-600",
  active: "bg-emerald-50 text-emerald-600", paused: "bg-amber-50 text-amber-600",
  completed: "bg-slate-100 text-slate-600", archived: "bg-slate-100 text-slate-400",
};

export default function CampaignDelivery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignForm, setReassignForm] = useState({ from_user_id: "", to_user_id: "", reason: "" });

  const isManager = ["platform_owner", "organisation_admin", "sales_manager"].includes(user?.app_role);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await base44.functions.invoke("getCampaignDelivery", { campaign_id: id });
      setData(res.data || res);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const reassign = async () => {
    if (!reassignForm.to_user_id || !reassignForm.reason) return;
    setReassigning(true);
    try {
      await base44.functions.invoke("reassignCampaignWork", {
        campaign_id: id,
        from_user_id: reassignForm.from_user_id || undefined,
        to_user_id: reassignForm.to_user_id,
        reason: reassignForm.reason,
      });
      setReassignForm({ from_user_id: "", to_user_id: "", reason: "" });
      await load();
    } catch (e) { setError(e.message); } finally { setReassigning(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error) return <div className="text-rose-600 text-sm">{error}</div>;
  if (!data) return null;

  const { campaign, metrics, callers } = data;
  const stats = [
    { icon: Building2, label: "Total companies", value: metrics.totalCompanies },
    { icon: Phone, label: "Calls attempted", value: metrics.callsAttempted },
    { icon: MessageSquare, label: "Conversations", value: metrics.conversations },
    { icon: Clock, label: "Callbacks", value: metrics.callbacks },
    { icon: UserCheck, label: "Interested", value: metrics.interested },
    { icon: AlertTriangle, label: "Overdue follow-ups", value: metrics.overdueFollowUps, tone: metrics.overdueFollowUps > 0 ? "amber" : "" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/campaigns")} className="text-slate-400 hover:text-slate-900 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">{campaign.name}</h1>
            <p className="text-sm text-slate-500">{campaign.client_name} · {campaign.start_date || "—"} → {campaign.end_date || "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/campaigns/${id}/accounts`)}>
            <Building2 className="w-4 h-4 mr-1.5" /> Accounts &amp; notes
          </Button>
          <CampaignExportButton campaignId={id} />
          <Button variant="outline" onClick={()=>navigate(`/campaigns?tab=prospect&campaign=${id}`)}>Open in Prospecting</Button>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_TONES[campaign.status] || STATUS_TONES.draft}`}>
            {STATUS_LABELS[campaign.status] || campaign.status}
          </span>
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Progress</span>
          <span className="text-sm text-slate-400">{metrics.companiesContacted} of {metrics.totalCompanies} companies contacted</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${metrics.progressPercent}%` }} />
        </div>
        {campaign.total_call_target && (
          <p className="text-xs text-slate-400 mt-2">{campaign.total_call_target} total call target · {metrics.callTargetProgress}% achieved</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <s.icon className={`w-4 h-4 mb-2 ${s.tone === "amber" ? "text-amber-500" : "text-slate-400"}`} />
            <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <CampaignBriefEditor campaignId={id} />
      <DataReadinessPanel campaignId={id} />
      <ReviewQueuePanel campaignId={id} onChanged={load} />

      {/* Caller workload */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" /> Caller workload
          </h2>
        </div>
        {callers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No callers assigned to this campaign yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Caller</th>
                  <th className="text-center px-3 py-2 font-medium">Assigned</th>
                  <th className="text-center px-3 py-2 font-medium">Completed</th>
                  <th className="text-center px-3 py-2 font-medium">Due today</th>
                  <th className="text-center px-3 py-2 font-medium">Overdue</th>
                  <th className="text-center px-3 py-2 font-medium">Callbacks</th>
                  <th className="text-center px-3 py-2 font-medium">Conversations</th>
                  <th className="text-center px-3 py-2 font-medium">Qualified</th>
                </tr>
              </thead>
              <tbody>
                {callers.map((c) => (
                  <tr key={c.user_id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="text-center px-3 py-3 text-slate-600">{c.assigned}</td>
                    <td className="text-center px-3 py-3 text-slate-600">{c.completed}</td>
                    <td className="text-center px-3 py-3 text-slate-600">{c.dueToday}</td>
                    <td className="text-center px-3 py-3">
                      <span className={c.overdue > 0 ? "text-amber-600 font-medium" : "text-slate-600"}>{c.overdue}</span>
                    </td>
                    <td className="text-center px-3 py-3 text-slate-600">{c.callbacks}</td>
                    <td className="text-center px-3 py-3 text-slate-600">{c.conversations}</td>
                    <td className="text-center px-3 py-3 text-slate-600">{c.qualified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reassignment controls (managers only) */}
      {isManager && callers.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Reassign work</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={reassignForm.from_user_id} onChange={(e) => setReassignForm({ ...reassignForm, from_user_id: e.target.value })}>
              <option value="">From: all callers</option>
              {callers.map((c) => <option key={c.user_id} value={c.user_id}>From: {c.name}</option>)}
            </select>
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={reassignForm.to_user_id} onChange={(e) => setReassignForm({ ...reassignForm, to_user_id: e.target.value })}>
              <option value="">To: select caller</option>
              {callers.map((c) => <option key={c.user_id} value={c.user_id}>To: {c.name}</option>)}
            </select>
            <input className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" placeholder="Reason (required)" value={reassignForm.reason} onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })} />
          </div>
          <Button onClick={reassign} disabled={!reassignForm.to_user_id || !reassignForm.reason || reassigning} className="mt-3">
            {reassigning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Reassign open work
          </Button>
        </div>
      )}
    </div>
  );
}