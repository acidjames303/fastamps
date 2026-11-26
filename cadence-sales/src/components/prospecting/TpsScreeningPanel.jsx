import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, PhoneOff, CircleSlash, AlertTriangle } from "lucide-react";
import PushProgress from "@/components/PushProgress";
import ProdataConnectionStatus from "@/components/prospecting/ProdataConnectionStatus";
import { screeningState } from "@/lib/screeningStatus";

const CHUNK = 100;

function Chip({ icon: Icon, label, tone }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

// Optional TPS / CTPS screening for a prospecting list. The BDM decides whether
// to run it; results are stored on each prospect so they can be filtered and
// only the safe accounts selected for pushing.
export default function TpsScreeningPanel({ listId, prospects = [], selectedIds = [], onScreened }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [connection, setConnection] = useState(null);
  const [statusKey, setStatusKey] = useState(0);

  const counts = useMemo(() => {
    const states = prospects.map((p) => screeningState(p));
    return {
      safe: states.filter((s) => s === "safe").length,
      listed: states.filter((s) => s === "listed").length,
      expired: states.filter((s) => s === "expired" || s === "changed").length,
      unchecked: states.filter((s) => s === "unchecked").length,
    };
  }, [prospects]);

  const disconnected = connection && connection.connected === false;

  const run = async (ids) => {
    if (!ids.length || running) return;
    setRunning(true);
    setError("");
    setNote("");
    setProgress({ done: 0, total: ids.length });
    const totals = { safe: 0, listed: 0, unavailable: 0, suppressed: 0 };
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await base44.functions.invoke("screenProspectsTps", { list_id: listId, prospect_ids: chunk });
        const data = res?.data || res;
        if (data?.error) throw new Error(data.error);
        totals.safe += data?.safe || 0;
        totals.listed += data?.listed || 0;
        totals.unavailable += data?.unavailable || 0;
        totals.suppressed += data?.suppressed || 0;
        setProgress({ done: Math.min(i + CHUNK, ids.length), total: ids.length });
      }
      setNote(
        `Checked ${ids.length} account${ids.length === 1 ? "" : "s"} — ${totals.safe} safe, ${totals.listed} listed, ${totals.unavailable} could not be verified.` +
          (totals.suppressed ? ` ${totals.suppressed} number${totals.suppressed === 1 ? " was" : "s were"} on our do-not-call list.` : ""),
      );
      setStatusKey((k) => k + 1);
      await onScreened?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not run the TPS/CTPS check.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  if (!listId || prospects.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">TPS &amp; CTPS screening</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
              Optional 121 Prodata check of every number on this list against both registers. Each number gets its own
              result, so you can push only the accounts that are safe to call.
            </p>
            <div className="mt-2">
              <ProdataConnectionStatus refreshKey={statusKey} onStatus={setConnection} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => run(selectedIds)}
            disabled={running || selectedIds.length === 0 || disconnected}
          >
            Check selected ({selectedIds.length})
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-slate-900 hover:bg-slate-800"
            onClick={() => run(prospects.map((p) => p.id))}
            disabled={running || disconnected}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
            {running ? "Checking…" : `Check all ${prospects.length}`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip icon={ShieldCheck} tone="emerald" label={`${counts.safe} safe to call`} />
        <Chip icon={PhoneOff} tone="rose" label={`${counts.listed} on TPS/CTPS`} />
        {counts.expired > 0 && <Chip icon={AlertTriangle} tone="amber" label={`${counts.expired} check expired or out of date`} />}
        <Chip icon={CircleSlash} tone="slate" label={`${counts.unchecked} not checked`} />
      </div>

      {running && progress && (
        <PushProgress label="Checking numbers with 121 Prodata…" done={progress.done} total={progress.total} />
      )}
      {note && <p className="text-xs text-emerald-700">{note}</p>}
      {note && <p className="text-xs text-slate-500">Any number that could not be verified is not counted as safe to call.</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}