import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

function formatElapsed(totalSeconds) {
  const seconds = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

// Global enrichment progress indicator — polls active EnrichmentSession records
// so background enrichment continues even when the user is away from the
// Prospecting page. Renders a circular progress ring next to the theme toggle.
// When enrichment completes, fires a toast so the user knows their fresh data
// is ready, and briefly shows a green checkmark before hiding.
export default function EnrichmentProgressIndicator() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [showComplete, setShowComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);
  const prevStatusRef = useRef(null);
  const notifiedRef = useRef(false);

  // Idle check — looks for active sessions when we don't have one.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const active = await base44.entities.EnrichmentSession.filter(
          { status: "processing" }, "-created_date", 1
        );
        if (cancelled) return;
        if (active[0]) {
          setSession((prev) => prev?.id === active[0].id ? prev : active[0]);
          prevStatusRef.current = "processing";
        }
      } catch {}
    };

    check();
    const idleTimer = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(idleTimer); };
  }, []);

  // Poll the active session to drive enrichment forward + update progress.
  useEffect(() => {
    if (!session || session.status !== "processing") return;

    const poll = async () => {
      try {
        const res = await base44.functions.invoke("pollEnrichmentJob", { session_id: session.id });
        const data = res.data || res;
        if (data.error) return;
        setSession(data);
      } catch {}
    };

    pollRef.current = setTimeout(poll, 3000);
    return () => clearTimeout(pollRef.current);
  }, [session]);

  // Keep the elapsed time visible and accurate across navigation and refreshes.
  useEffect(() => {
    if (!session || session.status !== "processing") return;
    const updateElapsed = () => {
      const start = session.started_at || session.created_date;
      setElapsed(start ? Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000)) : 0);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [session?.id, session?.started_at, session?.created_date, session?.status]);

  // Detect transition from processing → terminal, fire completion toast.
  useEffect(() => {
    if (!session) return;
    const prev = prevStatusRef.current;
    const current = session.status;

    if (prev === "processing" && ["completed", "partially_completed", "failed", "cancelled"].includes(current) && !notifiedRef.current) {
      notifiedRef.current = true;
      const total = session.total_records || 0;
      const done = (session.completed_count || 0) + (session.cached_count || 0) + (session.partial_count || 0) + (session.failed_count || 0);

      if (current === "completed") {
        toast({
          title: "Fresh data ready",
          description: `${done} of ${total} records enriched — head to Prospecting to review and push to your lists.`,
        });
      } else if (current === "partially_completed") {
        const failed = session.failed_count || 0;
        toast({
          title: "Fresh data ready",
          description: failed > 0
            ? `${done} of ${total} records enriched. ${failed} need attention in Prospecting.`
            : `${done} of ${total} records enriched — head to Prospecting to review and push to your lists.`,
        });
      } else if (current === "failed") {
        toast({
          title: "Enrichment finished with issues",
          description: `${done} of ${total} records processed. Some records may need attention in Prospecting.`,
          variant: "destructive",
        });
      }

      setShowComplete(true);
      const t = setTimeout(() => {
        setShowComplete(false);
        setSession(null);
        notifiedRef.current = false;
      }, 6000);
      return () => clearTimeout(t);
    }

    prevStatusRef.current = current;
  }, [session?.status]);

  // Completion state — green checkmark that fades after a few seconds.
  if (showComplete) {
    return (
      <button
        onClick={() => navigate("/prospecting")}
        className="p-1.5 rounded-full hover:bg-accent transition-colors"
        aria-label="Enrichment complete — view fresh data"
        title="Fresh data ready — click to go to Prospecting"
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-500" style={{ animation: "pop 0.3s ease-out" }} />
      </button>
    );
  }

  if (!session || session.status !== "processing") return null;

  const total = session.total_records || 0;
  const done = (session.completed_count || 0) + (session.partial_count || 0) + (session.failed_count || 0) + (session.cached_count || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const remaining = Math.max(0, total - done);

  return (
    <button
      onClick={() => navigate("/prospecting")}
      className="flex w-40 sm:w-56 flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50/90 px-2.5 sm:px-3 py-2 text-left shadow-sm hover:bg-emerald-100 transition-colors dark:border-emerald-800 dark:bg-emerald-950/60"
      aria-label={`Enrichment ${pct}% complete — ${done} of ${total} records — elapsed ${formatElapsed(elapsed)}`}
      title="View enrichment progress in Prospecting"
    >
      <span className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-200">
        <span className="hidden sm:inline">Enriching {done}/{total}</span>
        <span className="sm:hidden">{pct}%</span>
        <span>{formatElapsed(elapsed)}</span>
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
        <span className="block h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-full text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">{remaining} remaining · {pct}%</span>
    </button>
  );
}