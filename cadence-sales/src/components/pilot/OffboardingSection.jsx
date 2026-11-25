import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Pause, Play, CheckCircle, XCircle, RefreshCw } from "lucide-react";

// Offboarding section for Pilot Console.
// Shows pre-offboarding checklist and controlled offboarding actions.
// Never deletes customer data automatically.
export default function OffboardingSection({ organisationId, pilotStatus, onAction }) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [contacts, campaigns, tasks, opps, meetings, subs] = await Promise.all([
        base44.entities.Contact.filter({ organisation_id: organisationId }, '-created_date', 1),
        base44.entities.Campaign.filter({ organisation_id: organisationId, status: 'active' }),
        base44.entities.Task.filter({ organisation_id: organisationId, task_type: 'callback', status: 'open' }),
        base44.entities.Opportunity.filter({ organisation_id: organisationId }),
        base44.entities.Meeting.filter({ organisation_id: organisationId }),
        base44.entities.OrganisationSubscription.filter({ organisation_id: organisationId }),
      ]);
      setChecklist({
        active_contacts: contacts.length,
        active_campaigns: campaigns.length,
        open_callbacks: tasks.length,
        open_opportunities: opps.length,
        meetings: meetings.length,
        subscription_status: subs[0]?.status || 'none',
      });
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [organisationId]);

  const doAction = async (offboardType) => {
    if (!confirm(`Are you sure you want to ${offboardType} this pilot?`)) return;
    setActing(true);
    try {
      const summary = prompt("Completion summary (optional):") || "";
      await base44.functions.invoke("activatePilot", {
        action: "offboard",
        organisation_id: organisationId,
        offboard_type: offboardType,
        completion_summary: summary,
      });
      onAction();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally { setActing(false); }
  };

  const pauseOrResume = async (action) => {
    setActing(true);
    try {
      await base44.functions.invoke("activatePilot", { action, organisation_id: organisationId });
      onAction();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally { setActing(false); }
  };

  if (loading) return <p className="text-sm text-slate-400">Loading offboarding checklist…</p>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="font-display font-semibold text-slate-900">Offboarding</h2>
      <p className="text-xs text-slate-400">Review active work before offboarding. Customer data is never deleted automatically.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ChecklistItem label="Active contacts" value={checklist?.active_contacts ?? 0} />
        <ChecklistItem label="Active campaigns" value={checklist?.active_campaigns ?? 0} />
        <ChecklistItem label="Open callbacks" value={checklist?.open_callbacks ?? 0} />
        <ChecklistItem label="Open opportunities" value={checklist?.open_opportunities ?? 0} />
        <ChecklistItem label="Meetings" value={checklist?.meetings ?? 0} />
        <ChecklistItem label="Subscription" value={checklist?.subscription_status || 'none'} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {pilotStatus === "paused" ? (
          <Button variant="outline" size="sm" disabled={acting} onClick={() => pauseOrResume("resume")}>
            <Play className="w-3.5 h-3.5 mr-1" /> Resume
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={acting} onClick={() => pauseOrResume("pause")}>
            <Pause className="w-3.5 h-3.5 mr-1" /> Pause
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={acting} onClick={() => doAction("convert")}>
          <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Convert
        </Button>
        <Button variant="outline" size="sm" disabled={acting} onClick={() => doAction("extend")}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Extend
        </Button>
        <Button variant="outline" size="sm" disabled={acting} onClick={() => doAction("complete")}>
          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete
        </Button>
        <Button variant="outline" size="sm" disabled={acting} onClick={() => doAction("discontinue")}>
          <XCircle className="w-3.5 h-3.5 mr-1 text-rose-500" /> Discontinue
        </Button>
      </div>
    </div>
  );
}

function ChecklistItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-display font-semibold text-slate-900">{value}</p>
    </div>
  );
}