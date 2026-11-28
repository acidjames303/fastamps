import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

const LOW_CREDIT_THRESHOLD = 50;

// Live connection status for 121 Prodata: whether the connection is working and
// the remaining credit balance. Credential details stay server-side.
export default function ProdataConnectionStatus({ refreshKey = 0, onStatus }) {
  const [state, setState] = useState({ loading: true });

  const check = useCallback(async () => {
    setState({ loading: true });
    try {
      const res = await base44.functions.invoke("prodataConnectionStatus", {});
      const data = res?.data || res;
      setState({ loading: false, ...data });
      onStatus?.(data);
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || "Could not check the 121 Prodata connection.";
      setState({ loading: false, connected: false, detail });
      onStatus?.({ connected: false, detail });
    }
  }, [onStatus]);

  useEffect(() => { check(); }, [check, refreshKey]);

  if (state.loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking 121 Prodata connection…
      </span>
    );
  }

  if (!state.connected) {
    return (
      <span
        title={state.detail || ""}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
      >
        <AlertTriangle className="w-3 h-3" />
        <span className="max-w-md truncate">121 Prodata not connected — {state.detail || "no API key"}</span>
      </span>
    );
  }

  const credits = typeof state.credits === "number" ? state.credits : null;
  const low = credits !== null && credits < LOW_CREDIT_THRESHOLD;
  const label = [
    "121 Prodata connected",
    credits !== null ? `${credits.toLocaleString("en-GB")} credit${credits === 1 ? "" : "s"} left` : "",
  ].filter(Boolean).join(" · ");

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        title={label}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          low ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        {low ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
        {low ? `Low credits — ${credits.toLocaleString("en-GB")} left` : label}
      </span>
      <button
        type="button"
        onClick={check}
        title="Re-check the connection and credit balance"
        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </span>
  );
}