import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_STYLES = {
  operational: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Operational" },
  degraded: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Degraded" },
  disrupted: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Disrupted" },
  unknown: { dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-50", label: "Unknown" },
};

const SERVICE_LABELS = {
  authentication: "Authentication",
  database: "Database / Entities",
  today_queue: "Today Queue",
  outcome_processing: "Outcome Processing",
  callback_creation: "Callback Creation",
  twilio: "Twilio / Telephony",
  billing: "Billing",
  reports: "Reports",
  crm_webhooks: "CRM / Webhooks",
  scheduled_jobs: "Scheduled Jobs",
  usage_ledger: "Usage Ledger",
};

export default function HealthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getHealthDashboard", {});
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-slate-400">Checking system health…</div>;
  if (error) return (
    <div className="p-8 space-y-4">
      <p className="text-rose-600">Failed to load health data: {error}</p>
      <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
    </div>
  );

  const { overall_status, services, recent_errors, error_count_last_hour } = data;
  const overallStyle = STATUS_STYLES[overall_status] || STATUS_STYLES.unknown;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Activity className="w-7 h-7 text-slate-700" /> System Health
          </h1>
          <p className="text-slate-500 mt-1">Platform health indicators based on recent evidence.</p>
        </div>
        <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <div className={`rounded-2xl border p-6 ${overallStyle.bg} border-current`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${overallStyle.dot} animate-pulse`} />
          <p className="font-display text-xl font-semibold text-slate-900">{overallStyle.label}</p>
          {error_count_last_hour > 0 && (
            <span className="ml-auto text-sm text-slate-500">{error_count_last_hour} error(s) in the last hour</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(services).map(([key, service]) => {
          const style = STATUS_STYLES[service.status] || STATUS_STYLES.unknown;
          return (
            <div key={key} className={`rounded-xl border border-slate-200 p-4 ${style.bg}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <p className="font-medium text-slate-900 text-sm">{SERVICE_LABELS[key] || key}</p>
              </div>
              <p className={`text-xs mt-1 ${style.text}`}>{style.label}</p>
            </div>
          );
        })}
      </div>

      {recent_errors && recent_errors.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Recent Errors
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {recent_errors.map((err, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${err.severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {err.severity}
                </span>
                <span className="text-sm text-slate-600 flex-1 truncate">{err.message}</span>
                <span className="text-xs text-slate-400">{err.category}</span>
                {err.resolved && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}