import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CATEGORY_COLORS = {
  critical: "text-rose-600",
  compliance: "text-amber-600",
  performance: "text-blue-600",
  accessibility: "text-violet-600",
  operational: "text-slate-600",
};

const STATUS_ICON = {
  pass: CheckCircle2,
  fail: XCircle,
  pending: Clock,
};

const STATUS_COLOR = {
  pass: "text-emerald-600 bg-emerald-50",
  fail: "text-rose-600 bg-rose-50",
  pending: "text-slate-400 bg-slate-50",
};

export default function PilotReadiness() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getPilotReadiness", {});
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-slate-400">Checking pilot readiness…</div>;
  if (error) return (
    <div className="p-8 space-y-4">
      <p className="text-rose-600">Failed to load readiness checks: {error}</p>
      <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
    </div>
  );

  const { ready, summary, checks, organisation_name, pilot_status } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-slate-700" /> Pilot Readiness
          </h1>
          <p className="text-slate-500 mt-1">{organisation_name} · Status: <span className="font-medium text-slate-700">{pilot_status}</span></p>
        </div>
        <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Re-run checks</Button>
      </div>

      <div className={`rounded-2xl border p-6 ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-3">
          {ready ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> : <AlertTriangle className="w-8 h-8 text-amber-600" />}
          <div>
            <p className="font-display text-xl font-semibold text-slate-900">
              {ready ? "Pilot ready" : "Not pilot ready"}
            </p>
            <p className="text-sm text-slate-500">
              {summary.passed} passed · {summary.failed} failed · {summary.pending} pending out of {summary.total} checks
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {Object.entries(checks).map(([key, check]) => {
          const Icon = STATUS_ICON[check.status] || Clock;
          return (
            <div key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${STATUS_COLOR[check.status]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 text-sm">{key.replace(/_/g, ' ')}</p>
                  <Badge variant="outline" className="text-xs capitalize">{check.status}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{check.notes}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}