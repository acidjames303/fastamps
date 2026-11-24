import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_STYLES = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-rose-50 text-rose-700 border-rose-200",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};

const HEALTH_DOT = {
  healthy: "bg-emerald-500",
  needs_attention: "bg-amber-500",
  at_risk: "bg-rose-500",
  paused: "bg-slate-400",
  unknown: "bg-slate-300",
};

const HEALTH_LABEL = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  at_risk: "At risk",
  paused: "Paused",
  unknown: "Unknown",
};

export default function PilotHealthPanel({ organisationId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getPilotHealth", { organisation_id: organisationId });
      setData(res.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="rounded-2xl border border-slate-200 bg-white p-5"><Loader2 className="w-4 h-4 text-slate-300 animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-slate-900">Pilot Health</h2>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-3 h-3 rounded-full ${HEALTH_DOT[data.health] || HEALTH_DOT.unknown}`} />
        <p className="font-display text-lg font-semibold text-slate-900">{HEALTH_LABEL[data.health] || HEALTH_LABEL.unknown}</p>
      </div>
      {data.factors && data.factors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {data.factors.map((f) => (
            <div key={f.key} className={`text-xs px-3 py-2 rounded-lg border ${STATUS_STYLES[f.status] || STATUS_STYLES.unknown}`}>
              <p className="font-medium">{f.label}</p>
              <p className="mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3">{data.summary}</p>
    </div>
  );
}