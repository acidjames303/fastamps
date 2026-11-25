import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2, CheckCircle2, XCircle, ShieldCheck, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ExternalPilotGate({ organisationId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getExternalPilotGate", { organisation_id: organisationId });
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

  const passed = data.gate_passed;
  const passedCount = data.checks.filter((c) => c.passed).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-700" />
          <h2 className="font-display font-semibold text-slate-900">External Pilot Gate</h2>
        </div>
        <div className="flex items-center gap-2">
          {passed ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <Rocket className="w-3 h-3 mr-1" /> Ready for controlled pilot
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {data.blockers.length} blocker(s)
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Final gate before first unsupervised external calling session. {passedCount} of {data.total_checks} checks passed.
      </p>

      {data.blockers.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
          <p className="text-xs font-medium text-amber-800 mb-1">Blockers:</p>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {data.blockers.map((b, i) => <li key={i}>• {b}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {data.checks.map((c) => (
          <div key={c.key} className="flex items-start gap-2 text-sm">
            {c.passed
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className={c.passed ? "text-slate-600" : "text-slate-500"}>{c.label}</p>
              {c.notes && <p className="text-xs text-slate-400 truncate">{c.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}