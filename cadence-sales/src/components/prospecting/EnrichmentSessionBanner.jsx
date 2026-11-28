import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Database, Clock, X, AlertTriangle, Zap, Sparkles, Coins, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { formatElapsed, sessionElapsedSeconds, sessionIsStalled } from "@/lib/sessionTiming";
import { enrichmentSessionNextAction } from "@/lib/enrichmentNextAction";

// Background enrichment progress banner — shows when an enrichment session is
// running, paused, or recently completed. When done, surfaces a guided next
// step (call / outreach / review) instead of a vague “look at Prospecting”.
export default function EnrichmentSessionBanner({
  session,
  onDismiss,
  onCancelled,
  onProspectingPage = false,
  onFilterAttention,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState("");
  const [forceAvailable, setForceAvailable] = useState(false);
  const [elapsed, setElapsed] = useState(() => sessionElapsedSeconds(session));

  const isQueued = session?.status === "queued";
  const isRunning = ["queued", "processing"].includes(session?.status);
  const isStalled = sessionIsStalled(session);

  // Tick only while the session is genuinely running. A finished session is
  // measured to its last recorded activity, so a run that ended weeks ago can
  // never show a counter that keeps climbing.
  useEffect(() => {
    setElapsed(sessionElapsedSeconds(session));
    if (!isRunning || isStalled) return;
    const interval = setInterval(() => setElapsed(sessionElapsedSeconds(session)), 1000);
    return () => clearInterval(interval);
  }, [
    session?.id, session?.status, session?.started_at,
    session?.completed_at, session?.last_activity_at, isRunning, isStalled,
  ]);

  if (!session) return null;

  const pct = session.total_records > 0
    ? Math.round(((session.completed_count + session.partial_count + session.failed_count + session.cached_count) / session.total_records) * 100)
    : 0;

  const isDone = ["completed", "partially_completed", "failed", "cancelled"].includes(session.status);
  const next = isDone ? enrichmentSessionNextAction(session, { onProspectingPage }) : null;

  const statusColor = isRunning ? "bg-blue-50 border-blue-200" : isDone ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200";
  const iconColor = isRunning ? "text-blue-600" : isDone ? "text-emerald-600" : "text-amber-600";

  // Attempt to cancel the session. Retries a few times because the background
  // poller may be updating the same record concurrently.
  const attemptCancel = async (force = false) => {
    setCancelling(true);
    setCancelErr("");
    // The poll response uses session_id; the entity uses id. Handle both.
    const sessionId = session.id || session.session_id;
    if (!sessionId) {
      setCancelErr("Session ID not found — the session may have already been removed.");
      setForceAvailable(true);
      setCancelling(false);
      return;
    }
    const patch = {
      status: "cancelled",
      queued_count: 0,
      processing_count: 0,
      completed_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    // Reset any in-flight items so the next poll doesn't pick them up.
    if (session.items) {
      patch.items = session.items.map((i) =>
        i.status === "processing" || i.status === "pending" ? { ...i, status: "failed", error: "Session cancelled by user" } : i
      );
    }
    let lastErr = null;
    for (let attempt = 0; attempt < (force ? 5 : 3); attempt++) {
      try {
        await base44.entities.EnrichmentSession.update(sessionId, patch);
        setConfirmOpen(false);
        setForceAvailable(false);
        onCancelled && onCancelled();
        return;
      } catch (e) {
        lastErr = e;
        // Brief pause to let the poller release the record.
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    // Normal cancel failed — offer force override.
    setCancelErr(lastErr?.message || "The session is being updated in the background and couldn't be cancelled.");
    setForceAvailable(true);
    setCancelling(false);
  };

  return (
    <>
      <div className={`rounded-2xl border ${statusColor} p-4`}>
        <div className="flex items-start gap-3">
          {isRunning ? (
            <Loader2 className={`w-5 h-5 ${iconColor} animate-spin flex-shrink-0 mt-0.5`} />
          ) : isDone ? (
            <CheckCircle2 className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
          ) : (
            <Clock className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900 truncate">
                {isQueued ? "Preparing enrichment session" : isRunning ? "Enrichment running in background" : isDone ? "Enrichment complete" : "Enrichment paused"}
                {session.session_name ? <span className="text-slate-400 font-normal ml-1">— {session.session_name}</span> : null}
              </p>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <button
                    onClick={() => { setCancelErr(""); setForceAvailable(false); setConfirmOpen(true); }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 rounded-full px-2 py-0.5 hover:bg-rose-50 transition-colors"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                )}
                {onDismiss && isDone && (
                  <button onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {isRunning && (
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}

            {/* Stats */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span
                className="flex items-center gap-1 font-medium text-slate-700"
                title={isRunning ? "Time since this enrichment started" : "How long this enrichment took"}
              >
                <Clock className="w-3 h-3" /> {isRunning ? formatElapsed(elapsed) : `${formatElapsed(elapsed)} run`}
              </span>
              <span>{Math.min(session.completed_count + session.partial_count + session.failed_count + session.cached_count, session.total_records)} of {session.total_records} processed</span>
              {isRunning && session.queued_count > 0 && <span>{session.queued_count} remaining</span>}
              {session.cached_count > 0 && <span className="flex items-center gap-0.5"><Database className="w-3 h-3" /> {session.cached_count} cached</span>}
              {session.completed_count > 0 && <span className="text-emerald-600">✓ {session.completed_count} complete</span>}
              {session.partial_count > 0 && <span className="text-amber-600">◐ {session.partial_count} partial</span>}
              {session.failed_count > 0 && <span className="text-rose-600">✕ {session.failed_count} failed</span>}
              <span className="font-semibold text-slate-700">{pct}%</span>
            </div>

            {isDone && session.partial_count > 0 && (
              <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {session.partial_count} records are partial: some of the requested fields weren't found. Everything found is saved — a partial record is not a provider failure.
              </p>
            )}

            {isStalled && (
              <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> No progress recorded for a while — this session looks stalled. Cancel it and start a fresh run.
              </p>
            )}

            {isDone && next && (
              <div className="mt-3 rounded-xl border border-emerald-200/80 bg-white/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Enrichment · what next
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{next.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{next.detail}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {next.href && next.cta && (
                    <Link
                      to={next.href}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      {next.cta} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                  {!next.href && next.cta && next.action === "filter_attention" && (
                    <button
                      type="button"
                      onClick={() => onFilterAttention?.()}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      {next.cta} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {next.secondary?.href && (
                    <Link
                      to={next.secondary.href}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {next.secondary.cta}
                    </Link>
                  )}
                  {next.secondary?.action === "filter_attention" && !next.secondary?.href && (
                    <button
                      type="button"
                      onClick={() => onFilterAttention?.()}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {next.secondary.cta}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Session cost report — shown when enrichment is done */}
            {isDone && (session.provider_calls_made > 0 || session.smart_actions_consumed > 0 || session.pattern_inferred_count > 0) && (
              <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {session.provider_calls_made > 0 && (
                  <span className="flex items-center gap-1" title="Actual paid provider API calls made">
                    <Coins className="w-3 h-3 text-amber-500" /> {session.provider_calls_made} provider call{session.provider_calls_made === 1 ? "" : "s"}
                  </span>
                )}
                {session.smart_actions_consumed > 0 && (
                  <span className="flex items-center gap-1" title="Base44 AI research actions used">
                    <Zap className="w-3 h-3 text-blue-500" /> {session.smart_actions_consumed} AI research
                  </span>
                )}
                {session.pattern_inferred_count > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600" title="Emails generated via pattern inference — no provider credit consumed">
                    <Sparkles className="w-3 h-3" /> {session.pattern_inferred_count} credit-free email{session.pattern_inferred_count === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel confirmation / force-override dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!cancelling) setConfirmOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {forceAvailable ? "Cancel failed — force it?" : "Cancel enrichment session?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {forceAvailable ? (
                <>
                  The session couldn't be cancelled automatically (it's being updated in the background). Forcing it will retry several times and mark any in-progress records as failed. Your enriched data so far is kept.
                  {cancelErr && <span className="block mt-2 text-xs text-rose-600">{cancelErr}</span>}
                </>
              ) : (
                <>
                  Cancelling will stop processing and mark any in-progress or queued records as failed. Records already enriched will be kept. You can start a new session afterwards.
                  {cancelErr && <span className="block mt-2 text-xs text-rose-600">{cancelErr}</span>}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={cancelling}>Keep running</AlertDialogCancel>
            {forceAvailable ? (
              <AlertDialogAction
                disabled={cancelling}
                onClick={(e) => { e.preventDefault(); attemptCancel(true); }}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {cancelling ? "Forcing…" : "Force cancel"}
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                disabled={cancelling}
                onClick={(e) => { e.preventDefault(); attemptCancel(false); }}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {cancelling ? "Cancelling…" : "Cancel session"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}