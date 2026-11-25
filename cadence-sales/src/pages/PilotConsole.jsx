import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Rocket, RefreshCw, CheckCircle2, Clock, Users, PhoneCall, ClipboardList, AlertTriangle, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WeeklyReviewSection from "@/components/pilot/WeeklyReviewSection";
import OffboardingSection from "@/components/pilot/OffboardingSection";
import PilotVerificationSection from "@/components/pilot/PilotVerificationSection";
import PilotHealthPanel from "@/components/pilot/PilotHealthPanel";
import ExternalPilotGate from "@/components/pilot/ExternalPilotGate";

const HEALTH_STYLES = {
  healthy: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Healthy" },
  needs_attention: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Needs attention" },
  at_risk: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "At risk" },
  paused: { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", label: "Paused" },
  unknown: { dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-50", label: "Unknown" },
};

export default function PilotConsole() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [activation, setActivation] = useState(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getPilotDashboard", {
        selected_organisation_id: selectedOrgId || undefined,
      });
      setData(res.data);
      if (!selectedOrgId && res.data.organisation?.id) {
        setSelectedOrgId(res.data.organisation.id);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  const loadActivation = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await base44.functions.invoke("activatePilot", { action: "check", organisation_id: selectedOrgId });
      setActivation(res.data);
    } catch (e) { /* ignore */ }
  }, [selectedOrgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadActivation(); }, [loadActivation]);

  const doActivate = async (action) => {
    setActing(true);
    try {
      await base44.functions.invoke("activatePilot", { action, organisation_id: selectedOrgId });
      load();
      loadActivation();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally { setActing(false); }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading pilot dashboard…</div>;
  if (error) return (
    <div className="p-8 space-y-4">
      <p className="text-rose-600">{error}</p>
      <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
    </div>
  );

  const { pilot, health, milestones, adoption, support, feedback, actions } = data;
  const orgId = data.organisation?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Rocket className="w-7 h-7 text-slate-700" /> Pilot Console
          </h1>
          <p className="text-slate-500 mt-1">{data.organisation.name} · {data.organisation.pilot_status || 'setup'}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.organisations && data.organisations.length > 0 && (
            <Select value={selectedOrgId || data.organisation.id} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {data.organisations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        </div>
      </div>

      {/* Pilot Health */}
      {pilot && (
        <div className={`rounded-2xl border p-5 ${(HEALTH_STYLES[health.status] || HEALTH_STYLES.unknown).bg}`}>
          <div className="flex items-center gap-3 mb-3">
            <span className={`w-3 h-3 rounded-full ${(HEALTH_STYLES[health.status] || HEALTH_STYLES.unknown).dot}`} />
            <p className="font-display text-lg font-semibold text-slate-900">{(HEALTH_STYLES[health.status] || HEALTH_STYLES.unknown).label}</p>
            <Badge variant="outline" className="ml-auto">{pilot.status}</Badge>
          </div>
          {health.factors && health.factors.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {health.factors.map(f => (
                <div key={f.label} className={`text-xs px-2 py-1.5 rounded-lg ${f.contributing ? 'bg-rose-100 text-rose-700' : 'bg-white/60 text-slate-600'}`}>
                  <p className="font-medium">{f.label}</p><p>{f.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activation Gate */}
      {activation && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-slate-900">Activation Gate</h2>
            {activation.all_passed ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">All checks passed</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">{activation.blockers.length} blockers</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activation.checks.map(c => (
              <div key={c.key} className="flex items-center gap-2 text-sm">
                {c.passed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                <span className={c.passed ? 'text-slate-600' : 'text-slate-500'}>{c.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4 border-t border-slate-100 pt-4">
            {pilot?.status === 'paused' ? (
              <Button size="sm" disabled={acting} onClick={() => doActivate('resume')}>
                <Play className="w-3.5 h-3.5 mr-1" /> Resume pilot
              </Button>
            ) : (
              <Button size="sm" disabled={acting || !activation.all_passed} onClick={() => doActivate('activate')}>
                <Rocket className="w-3.5 h-3.5 mr-1" /> Activate pilot
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={acting} onClick={() => doActivate('pause')}>
              <Pause className="w-3.5 h-3.5 mr-1" /> Pause
            </Button>
          </div>
        </div>
      )}

      {/* Deterministic Pilot Health — Sprint 15 */}
      {orgId && <PilotHealthPanel organisationId={orgId} />}

      {/* External Pilot Gate — Sprint 15 */}
      {orgId && <ExternalPilotGate organisationId={orgId} />}

      {/* Pilot Verification Workspace — Sprint 14D */}
      {orgId && <PilotVerificationSection organisationId={orgId} onSaved={() => { load(); loadActivation(); }} />}

      {/* Milestones */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-display font-semibold text-slate-900 mb-3">Activation Milestones</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {milestones.list.map(m => (
            <div key={m.key} className="flex items-center gap-2 text-sm">
              {m.achieved
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <Clock className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              <span className={m.achieved ? 'text-slate-700' : 'text-slate-400'}>{m.key.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Adoption Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} label="Weekly active callers" value={adoption.weekly_active_callers} />
        <MetricCard icon={PhoneCall} label="Calls total" value={adoption.calls_total} />
        <MetricCard icon={CheckCircle2} label="Outcomes saved" value={adoption.outcomes_saved} />
        <MetricCard icon={ClipboardList} label="Callbacks completed" value={`${adoption.callbacks_completed}/${adoption.callbacks_created}`} />
        <MetricCard icon={AlertTriangle} label="Overdue callbacks" value={adoption.overdue_callbacks} accent={adoption.overdue_callbacks > 0 ? 'text-rose-600' : ''} />
        <MetricCard icon={Rocket} label="Active campaigns" value={adoption.active_campaigns} />
        <MetricCard icon={Users} label="Opportunities" value={adoption.opportunities} />
        <MetricCard icon={ClipboardList} label="Handoffs" value={adoption.handoffs} />
      </div>

      {/* Support & Feedback */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display font-semibold text-slate-900 mb-3">Open Support Requests</h2>
          {support.recent.length === 0 ? (
            <p className="text-sm text-slate-400">No support requests.</p>
          ) : (
            <div className="space-y-2">
              {support.recent.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={`text-xs ${s.priority === 'critical' ? 'text-rose-600' : s.priority === 'high' ? 'text-amber-600' : 'text-slate-500'}`}>{s.priority}</Badge>
                  <span className="text-slate-700 flex-1 truncate">{s.title}</span>
                  <span className="text-xs text-slate-400">{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display font-semibold text-slate-900 mb-3">Recent Feedback</h2>
          {feedback.recent.length === 0 ? (
            <p className="text-sm text-slate-400">No feedback yet.</p>
          ) : (
            <div className="space-y-2">
              {feedback.recent.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">{f.type}</Badge>
                  <span className="text-slate-700 flex-1 truncate">{f.title}</span>
                  <span className="text-xs text-slate-400">{f.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open Actions */}
      {actions && actions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-display font-semibold text-slate-900 mb-3">Open Pilot Actions</h2>
          <div className="space-y-2">
            {actions.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">{a.priority}</Badge>
                <span className="text-slate-700 flex-1 truncate">{a.title}</span>
                <span className="text-xs text-slate-400">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Review */}
      {orgId && <WeeklyReviewSection organisationId={orgId} onSaved={load} />}

      {/* Offboarding */}
      {orgId && pilot && <OffboardingSection organisationId={orgId} pilotStatus={pilot.status} onAction={() => { load(); loadActivation(); }} />}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Icon className="w-4 h-4 text-slate-400 mb-2" />
      <p className={`text-2xl font-display font-semibold ${accent || 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}