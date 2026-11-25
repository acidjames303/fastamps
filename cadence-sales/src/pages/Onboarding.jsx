import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ClipboardCheck, CheckCircle2, Circle, ArrowRight, AlertCircle, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEP_LINKS = {
  confirm_details: '/my-profile',
  privacy_settings: '/settings?section=more',
  connect_telephony: '/settings',
  test_call: '/dialer',
  invite_team: '/team',
  create_campaign: '/campaigns?new=1',
  add_companies: '/campaigns?tab=import',
  assign_callers: '/campaigns',
  first_call: '/dialer',
  first_callback: '/dialer',
  view_results: '/results',
  first_report: '/results',
};

export default function Onboarding() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getOrgPilotSummary", {});
      setSummary(res.data);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-slate-400">Loading onboarding…</p>;
  if (!summary) return <p className="text-slate-400">Unable to load onboarding data.</p>;

  const { onboarding, checks, pilot, role } = summary;

  const setApiSkipped = async (skipped) => {
    setSavingPreference(true);
    try {
      await base44.functions.invoke("updateOnboardingPreference", { skipped });
      await load();
    } finally {
      setSavingPreference(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-slate-700" /> Onboarding
        </h1>
        <p className="text-slate-500 mt-1">Only the steps relevant to your role are shown. Provider setup never blocks your core workflow.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-slate-900">Progress</p>
          <p className="text-sm text-slate-500">{onboarding.completed_count} of {onboarding.total_steps} complete</p>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${onboarding.progress_percent}%` }} />
        </div>
      </div>

      {!onboarding.workspace_setup_complete && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-950">Workspace setup is not complete</p>
            <p className="text-sm text-amber-800 mt-1">
              {role?.is_admin
                ? 'You can connect a calling or enrichment provider now, or skip it and finish later. Lists, notes, outcomes and exports remain available.'
                : 'Your Operations Admin still needs to finish provider setup. You can continue using assigned lists, notes, outcomes and results.'}
            </p>
            {role?.is_admin && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Link to="/settings"><Button size="sm" className="rounded-full"><Plug className="w-4 h-4 mr-1.5" /> Connect an API</Button></Link>
                <Button size="sm" variant="outline" className="rounded-full" disabled={savingPreference} onClick={() => setApiSkipped(!onboarding.api_setup_skipped)}>
                  {onboarding.api_setup_skipped ? 'Add API setup back' : 'Skip for now'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {onboarding.steps.map((step, i) => {
          const link = STEP_LINKS[step.key];
          return (
            <div key={step.key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex-shrink-0">
                {step.completed
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  : <Circle className="w-5 h-5 text-slate-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${step.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{i + 1}. {step.label}</p>
                {step.optional && <p className="text-xs text-slate-400 mt-0.5">{step.skipped ? 'Skipped for now — workspace setup remains incomplete' : 'Optional during onboarding'}</p>}
              </div>
              {link && (
                <Link to={link}>
                  <Button variant="ghost" size="sm" disabled={step.completed}>
                    {step.completed ? 'Done' : step.skipped ? 'Set up' : 'Start'} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {checks && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display font-semibold text-slate-900 mb-3">Readiness Checks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CheckItem label="Compliance configured" passed={checks.compliance_configured} />
            <CheckItem label="Telephony configured" passed={checks.telephony_configured} />
            <CheckItem label="Campaign created" passed={checks.campaign_created} />
            <CheckItem label="Team members" value={checks.team_members} />
          </div>
        </div>
      )}
    </div>
  );
}

function CheckItem({ label, passed, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      {value !== undefined ? (
        <p className="text-lg font-display font-semibold text-slate-900">{value}</p>
      ) : passed ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
      ) : (
        <Circle className="w-5 h-5 text-slate-300 mt-0.5" />
      )}
    </div>
  );
}