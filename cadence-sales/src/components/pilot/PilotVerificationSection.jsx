import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Clock, XCircle, AlertTriangle, Play, CheckCircle2,
  UserCheck, Monitor, Database, Cpu, Loader2, RefreshCw,
} from "lucide-react";

const METHOD_ICONS = {
  automated: Cpu,
  database_verification: Database,
  user_browser_confirmation: Monitor,
  platform_owner_confirmation: UserCheck,
};

const STATUS_STYLES = {
  passed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Passed" },
  not_tested: { icon: Clock, color: "text-slate-400", bg: "bg-slate-50", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-50", label: "Running" },
  failed: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", label: "Failed" },
  blocked: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Blocked" },
  expired: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Expired" },
};

// Pilot Verification workspace — guides the platform owner through the canonical
// readiness checks, with clear distinction between automated evidence and
// genuine browser confirmation. "Confirm only what you personally verified."
export default function PilotVerificationSection({ organisationId, onSaved }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("getPilotVerification", { organisation_id: organisationId });
      setData(res.data || res);
    } catch (e) {
      setError(e.message || "Could not load verification status.");
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => { load(); }, [load]);

  const confirmCheck = async (checkKey, method, passed) => {
    setActing(checkKey);
    setError("");
    try {
      await base44.functions.invoke("recordReadinessEvidence", {
        organisation_id: organisationId,
        check_key: checkKey,
        status: passed ? "passed" : "failed",
        evidence_method: method,
        evidence_summary: passed
          ? `Confirmed by platform owner via Pilot Verification workspace — ${checkKey}.`
          : `Marked as failed by platform owner — ${checkKey}.`,
        related_entity_type: "manual_verification",
        related_entity_ids: [],
        failure_reason: passed ? "" : "Platform owner marked this check as failed.",
        test_run_id: `manual-${Date.now()}`,
        automated: false,
        browser_session_required: method === "user_browser_confirmation",
      });
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message || "Could not record confirmation.");
    } finally {
      setActing(null);
    }
  };

  const runTest = async (fnName, checkKey) => {
    setActing(fnName);
    setError("");
    try {
      const res = await base44.functions.invoke(fnName, { organisation_id: organisationId });
      const result = res.data || res;
      if (result.passed) {
        await base44.functions.invoke("recordReadinessEvidence", {
          organisation_id: organisationId,
          check_key: checkKey,
          status: "passed",
          evidence_method: "automated",
          evidence_summary: result.evidence_summary,
          related_entity_type: "test_run",
          related_entity_ids: [],
          test_run_id: result.test_run_id,
          automated: true,
        });
      } else {
        await base44.functions.invoke("recordReadinessEvidence", {
          organisation_id: organisationId,
          check_key: checkKey,
          status: "failed",
          evidence_method: "automated",
          evidence_summary: result.evidence_summary || "Automated test failed.",
          related_entity_type: "test_run",
          related_entity_ids: [],
          test_run_id: result.test_run_id,
          automated: true,
          failure_reason: JSON.stringify(result.assertions || {}),
        });
      }
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message || `Could not run ${fnName}.`);
    } finally {
      setActing(null);
    }
  };

  if (loading) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading verification status…
      </p>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-rose-600 mb-3">{error}</p>
      <Button onClick={load} variant="outline" size="sm"><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retry</Button>
    </div>
  );

  const { checks = [], decision = "Blocked", internal = {}, external = {} } = data || {};
  const decisionStyle = decision === "Blocked"
    ? { bg: "bg-rose-50", text: "text-rose-700", icon: XCircle }
    : decision === "Ready for internal pilot"
    ? { bg: "bg-blue-50", text: "text-blue-700", icon: ShieldCheck }
    : { bg: "bg-emerald-50", text: "text-emerald-700", icon: ShieldCheck };

  return (
    <div className="space-y-4">
      {/* Activation Decision Banner */}
      <div className={`rounded-2xl border p-5 ${decisionStyle.bg}`}>
        <div className="flex items-center gap-3">
          <decisionStyle.icon className={`w-6 h-6 ${decisionStyle.text}`} />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold text-slate-900">Pilot Activation Decision</p>
            <p className={`text-sm font-medium ${decisionStyle.text}`}>{decision}</p>
          </div>
          <Button onClick={load} variant="ghost" size="sm"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
        {decision === "Blocked" && internal.blockers?.length > 0 && (
          <div className="mt-3 space-y-1">
            {internal.blockers.map((b, i) => (
              <p key={i} className="text-xs text-rose-600 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {b}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Verification Warning */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
        <p className="text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Confirm only what you personally verified in the browser.
        </p>
      </div>

      {/* Canonical Checks */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-display font-semibold text-slate-900 mb-1">Canonical Readiness Checks</h2>
        <p className="text-xs text-slate-400 mb-4">13 checks · evidence method must be acceptable for each check type</p>

        <div className="space-y-2">
          {checks.map((check) => {
            const style = STATUS_STYLES[check.status] || STATUS_STYLES.not_tested;
            const StatusIcon = style.icon;
            const MethodIcon = METHOD_ICONS[check.evidence_method] || Clock;
            const isActing = acting === check.key || acting === `suppression_enforcement` && check.key === "suppression_enforcement" || acting === `smoke_test` && check.key === "callback_creation";

            return (
              <div key={check.key} className={`rounded-xl border p-3 ${style.bg} border-slate-200`}>
                <div className="flex items-start gap-3">
                  <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.color} ${check.status === "running" ? "animate-spin" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900">{check.label}</p>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {check.category}
                      </Badge>
                      {check.evidence_method && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <MethodIcon className="w-3 h-3" /> {check.evidence_method.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{check.description}</p>
                    {check.reason && check.status !== "passed" && (
                      <p className="text-xs text-amber-600 mt-1">{check.reason}</p>
                    )}
                    {check.checked_at && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(check.checked_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-2">
                      {check.needs_browser_confirmation && (
                        <>
                          <Button
                            size="sm" variant="outline"
                            disabled={isActing}
                            onClick={() => confirmCheck(check.key, "user_browser_confirmation", true)}
                            className="h-7 text-xs rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Confirm passed
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            disabled={isActing}
                            onClick={() => confirmCheck(check.key, "user_browser_confirmation", false)}
                            className="h-7 text-xs rounded-full text-rose-500 hover:bg-rose-50"
                          >
                            Mark failed
                          </Button>
                        </>
                      )}
                      {check.needs_platform_confirmation && (
                        <>
                          <Button
                            size="sm" variant="outline"
                            disabled={isActing}
                            onClick={() => confirmCheck(check.key, "platform_owner_confirmation", true)}
                            className="h-7 text-xs rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            <UserCheck className="w-3 h-3 mr-1" /> Confirm
                          </Button>
                        </>
                      )}
                      {check.key === "suppression_enforcement" && !check.passed && (
                        <Button
                          size="sm" variant="outline"
                          disabled={isActing}
                          onClick={() => runTest("runSuppressionTest", "suppression_enforcement")}
                          className="h-7 text-xs rounded-full"
                        >
                          {acting === "runSuppressionTest" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                          Run suppression test
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Smoke Test */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-slate-900">Core Workflow Smoke Test</h2>
            <p className="text-xs text-slate-400 mt-0.5">Verifies CallLog creation, callback Task linkage, and duplicate prevention.</p>
          </div>
          <Button
            size="sm" variant="outline"
            disabled={acting === "runSmokeTest"}
            onClick={() => runTest("runSmokeTest", "callback_creation")}
            className="rounded-full"
          >
            {acting === "runSmokeTest" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
            Run smoke test
          </Button>
        </div>
      </div>
    </div>
  );
}