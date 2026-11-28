import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useEnrichmentSession } from "@/lib/enrichmentSession";
import { enrichmentSessionNextAction } from "@/lib/enrichmentNextAction";
import { formatElapsed, sessionElapsedSeconds, sessionIsStalled } from "@/lib/sessionTiming";

// Header enrichment indicator. It reads the app-wide enrichment tracker, so its
// numbers are exactly the ones Prospecting is working from. When a job finishes
// it shows a checkmark and a toast, then hides. It can be dismissed for the
// current job and comes back for the next one.
export default function EnrichmentProgressIndicator() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const session = useEnrichmentSession();
  const [elapsed, setElapsed] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [dismissedId, setDismissedId] = useState(null);
  const prevRef = useRef(null);
  const notifiedRef = useRef(false);

  // A new session starts clean: no leftover toast or checkmark from the last one.
  useEffect(() => {
    prevRef.current = session ? { id: session.id, status: session.status } : null;
    notifiedRef.current = false;
    setShowComplete(false);
  }, [session?.id]);

  // The same clock the Prospecting banner uses, so the two always agree.
  useEffect(() => {
    setElapsed(sessionElapsedSeconds(session));
    if (!["queued", "processing"].includes(session?.status) || sessionIsStalled(session)) return;
    const clock = setInterval(() => setElapsed(sessionElapsedSeconds(session)), 1000);
    return () => clearInterval(clock);
  }, [session?.id, session?.status, session?.started_at, session?.last_activity_at]);

  // Fire the completion toast once, when processing ends.
  useEffect(() => {
    if (!session) return;
    const prev = prevRef.current;
    const current = session.status;
    const finished = ["completed", "partially_completed", "failed", "cancelled"].includes(current);
    const justFinished = prev?.id === session.id && ["queued", "processing"].includes(prev.status) && finished;
    prevRef.current = { id: session.id, status: current };
    if (!justFinished || notifiedRef.current) return;

    notifiedRef.current = true;
    const total = session.total_records || 0;
    const done = (session.completed_count || 0) + (session.cached_count || 0) + (session.partial_count || 0) + (session.failed_count || 0);
    const next = enrichmentSessionNextAction(session);

    let title = next.title || "Fresh data ready";
    let description = next.detail || `${done} of ${total} records enriched.`;
    let variant;
    if (current === "partially_completed") {
      const failed = session.failed_count || 0;
      if (failed > 0 && next.id === "review_failures") {
        description = `${done} of ${total} records enriched. ${failed} need attention.`;
      }
    } else if (current === "failed") {
      title = "Enrichment finished with issues";
      description = `${done} of ${total} records processed. Some records may need attention.`;
      variant = "destructive";
    }

    const actionLabel = next.cta || "Review results";
    const actionHref = next.href;

    // Toast CTA follows the same next-step logic as the banner (call / review).
    const handle = toast({
      title,
      description,
      variant,
      action: (
        <button
          type="button"
          onClick={() => {
            handle?.dismiss();
            if (actionHref) navigate(actionHref);
            else openTarget();
          }}
          className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {actionLabel}
        </button>
      ),
    });

    setShowComplete(true);
    const fade = setTimeout(() => setShowComplete(false), 6000);
    const autoClose = setTimeout(() => handle?.dismiss(), 12000);
    return () => { clearTimeout(fade); clearTimeout(autoClose); };
  }, [session?.id, session?.status]);

  // Open the list this job enriched, not whichever list was last looked at.
  const openTarget = () =>
    navigate(session?.prospect_list_id ? `/campaigns?tab=prospect&list=${session.prospect_list_id}` : "/prospecting");

  if (showComplete) {
    return (
      <button
        onClick={openTarget}
        className="p-1.5 rounded-full hover:bg-accent transition-colors"
        aria-label="Enrichment complete — view fresh data"
        title="Fresh data ready — click to go to Prospecting"
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-500" style={{ animation: "pop 0.3s ease-out" }} />
      </button>
    );
  }

  if (!session || !["queued", "processing"].includes(session.status) || dismissedId === session.id) return null;
  // A stalled job stops ticking in the banner; it should not sit here counting up either.
  if (sessionIsStalled(session)) return null;

  const total = session.total_records || 0;
  const done = (session.completed_count || 0) + (session.partial_count || 0) + (session.failed_count || 0) + (session.cached_count || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const remaining = Math.max(0, total - done);

  return (
    <div className="relative">
      <button
        onClick={openTarget}
        className="flex w-36 flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50/90 px-2.5 py-2 pr-8 text-left shadow-sm transition-colors hover:bg-emerald-100 sm:w-56 sm:px-3 dark:border-emerald-800 dark:bg-emerald-950/60"
        aria-label={`Enrichment ${pct}% complete — ${done} of ${total} records — elapsed ${formatElapsed(elapsed)}`}
        title="View enrichment progress in Prospecting"
      >
        <span className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-200">
          <span className="hidden sm:inline">{session.status === "queued" ? "Preparing enrichment" : `Enriching ${done}/${total}`}</span>
          <span className="sm:hidden">{pct}%</span>
          <span>{formatElapsed(elapsed)}</span>
        </span>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
          <span
            className="block h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="hidden w-full text-[10px] text-slate-500 dark:text-slate-400 sm:block">
          {remaining} remaining · {pct}%
        </span>
      </button>
      <button
        type="button"
        onClick={() => setDismissedId(session.id)}
        aria-label="Hide enrichment progress"
        title="Hide this progress"
        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-emerald-700/70 transition-colors hover:bg-emerald-200 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-800"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}