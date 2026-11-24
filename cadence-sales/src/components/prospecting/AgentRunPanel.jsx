import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import AgentRunForm from "@/components/prospecting/agent/AgentRunForm";
import AgentRunProgress from "@/components/prospecting/agent/AgentRunProgress";
import AgentCandidateList from "@/components/prospecting/agent/AgentCandidateList";

const IN_FLIGHT = ["queued", "researching", "discovering", "saving"];

export default function AgentRunPanel() {
  const { user } = useAuth();
  const [lists, setLists] = useState([]);
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [session, setSession] = useState(null);
  const [starting, setStarting] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const advancingRef = useRef(false);
  const resumedRef = useRef("");
  const [config, setConfig] = useState({
    source_type: "url",
    seed_url: "",
    brief: "",
    icp: "",
    max_accounts: 10,
    prospect_list_id: "",
    permitted_countries: ["GB"],
    auto_enrich: true,
  });

  const loadLists = () => base44.entities.ProspectList.list("-created_date", 100).then(setLists).catch(() => {});
  const loadHistory = () => base44.entities.ProspectingRun.list("-created_date", 8).then(setRuns).catch(() => {});

  useEffect(() => {
    loadLists();
    loadHistory();
  }, []);

  // Follow the enrichment session this run started until it settles.
  useEffect(() => {
    if (run?.status !== "enriching" || !run?.enrichment_session_id) return;
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      try {
        const res = await base44.functions.invoke("pollEnrichmentJob", { session_id: run.enrichment_session_id });
        const data = res.data || res;
        if (cancelled) return;
        if (!data?.error) setSession(data);
        if (["completed", "partially_completed", "paused", "failed", "cancelled"].includes(data?.status)) {
          // Only a finished session closes the run as completed. A failed,
          // cancelled or spending-paused session keeps its own outcome so the
          // panel never reports work it did not finish.
          const patch = data.status === "completed" || data.status === "partially_completed"
            ? { status: "completed", current_phase: "done", error_summary: "" }
            : data.status === "cancelled"
              ? { status: "cancelled", current_phase: "done", error_summary: "" }
              : {
                status: "failed",
                current_phase: "done",
                error_summary: data.status === "paused"
                  ? `Enrichment paused: ${data.spending_pause_reason || "spending controls halted processing"}. Accounts are saved — resume enrichment when you are ready.`
                  : (data.error_summary || "Enrichment stopped before it finished. Accounts are saved."),
              };
          const updated = await base44.entities.ProspectingRun.update(run.id, patch);
          if (!cancelled) setRun(updated);
          return;
        }
      } catch {
        /* keep polling — the background worker continues regardless */
      }
      if (!cancelled) timer = setTimeout(tick, 5000);
    };
    timer = setTimeout(tick, 4000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [run?.id, run?.status, run?.enrichment_session_id]);

  const startEnrichment = async (current) => {
    try {
      const res = await base44.functions.invoke("startEnrichmentJob", {
        prospect_list_id: current.prospect_list_id,
        prospect_ids: current.prospect_ids,
        requested_fields: ["personal_email", "mobile", "decision_maker_role"],
        only_missing_fields: true,
        infer_email_pattern: true,
        idempotency_key: `prospecting_run:${current.id}`,
      });
      const data = res.data || res;
      if (data?.error) {
        setNote(`Accounts saved. Enrichment could not start: ${data.error}`);
        return;
      }
      const updated = await base44.entities.ProspectingRun.update(current.id, {
        status: "enriching",
        current_phase: "enrich",
        enrichment_session_id: data.session_id,
      });
      setRun(updated);
    } catch (e) {
      setNote(`Accounts saved. Enrichment could not start: ${e?.response?.data?.error || e.message}`);
    }
  };

  const advance = async (started) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      let current = started;
      let guard = 0;
      while (current && IN_FLIGHT.includes(current.status) && guard < 6) {
        const res = await base44.functions.invoke("runProspectingStep", { run_id: current.id });
        const data = res.data || res;
        if (data?.error) throw new Error(data.error);
        current = data.run;
        setRun(current);
        guard += 1;
      }
      loadHistory();
      loadLists();
      if (current?.status === "completed") {
        setNote("Accounts are saved in the prospect list below — push them to a campaign when you are ready to call.");
        if (current.auto_enrich && current.prospect_ids?.length) await startEnrichment(current);
      }
    } finally {
      advancingRef.current = false;
    }
  };

  // A refresh used to drop the run out of view. Restore the latest in-flight run
  // and carry on from the phase it saved, so its progress and accounts stay put.
  useEffect(() => {
    if (!runs.length || run) return;
    const active = runs.find((r) => IN_FLIGHT.includes(r.status) || r.status === "enriching");
    if (!active || resumedRef.current === active.id) return;
    resumedRef.current = active.id;
    setRun(active);
    if (IN_FLIGHT.includes(active.status)) {
      setNote("Picking up where this run left off.");
      advance(active).catch((e) => setError(e?.response?.data?.error || e.message));
    }
  }, [runs, run]);

  const start = async () => {
    setStarting(true);
    setError("");
    setNote("");
    setSession(null);
    try {
      const res = await base44.functions.invoke("startProspectingRun", {
        source_type: config.source_type,
        seed_url: config.seed_url,
        brief: config.brief,
        icp: config.icp,
        max_accounts: config.max_accounts,
        prospect_list_id: config.prospect_list_id || undefined,
        permitted_countries: config.permitted_countries,
        auto_enrich: config.auto_enrich,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setRun(data.run);
      await advance(data.run);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not start the run.");
    } finally {
      setStarting(false);
    }
  };

  const toggleCandidate = async (candidate) => {
    if (!run) return;
    const key = candidate.domain || candidate.name;
    setBusyKey(key);
    setError("");
    try {
      const accepting = candidate.verdict !== "accepted";
      let prospectId = candidate.prospect_id || "";
      if (accepting && !prospectId) {
        const created = await base44.entities.Prospect.create({
          list_id: run.prospect_list_id,
          company_name: candidate.name,
          domain: candidate.domain || "",
          website: candidate.website || "",
          industry: candidate.industry || "",
          employee_range: candidate.employee_range || "",
          location: candidate.location || "",
          country_code: candidate.country_code || "",
          fit_score: candidate.fit_score || 0,
          fit_reason: candidate.fit_reason || candidate.why_fits || "",
          target_role: (run.profile?.buyer_roles || [])[0] || "",
          enrichment_status: "pending",
          pushed: false,
          call_status: "new",
          organisation_id: user.organisation_id,
        });
        prospectId = created.id;
      }
      if (!accepting && prospectId) {
        await base44.entities.Prospect.delete(prospectId);
        prospectId = "";
      }
      const candidates = (run.candidates || []).map((c) =>
        (c.domain || c.name) === key
          ? { ...c, verdict: accepting ? "accepted" : "rejected", prospect_id: prospectId }
          : c,
      );
      const updated = await base44.entities.ProspectingRun.update(run.id, {
        candidates,
        prospect_ids: candidates.filter((c) => c.prospect_id).map((c) => c.prospect_id),
        accounts_qualified: candidates.filter((c) => c.verdict === "accepted").length,
        accounts_rejected: candidates.filter((c) => c.verdict === "rejected").length,
      });
      setRun(updated);
      loadLists();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not change this account.");
    } finally {
      setBusyKey("");
    }
  };

  const working = run && (IN_FLIGHT.includes(run.status) || run.status === "enriching");

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-600" /> Prospecting agent
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Give the agent a URL, an ICP or a brief. It researches the market, qualifies accounts against
            your profile and builds a callable list — with the evidence behind every pick.
          </p>
        </div>

        <AgentRunForm
          config={config}
          setConfig={setConfig}
          lists={lists}
          onStart={start}
          starting={starting || !!working}
          error={error}
        />

        {runs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] uppercase tracking-widest text-slate-400">Recent runs</span>
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRun(r); setSession(null); setNote(""); }}
                className={`text-xs rounded-full border px-3 py-1 truncate max-w-48 ${
                  run?.id === r.id
                    ? "border-slate-900 text-slate-900"
                    : "border-slate-200 text-slate-500 hover:border-slate-400"
                }`}
              >
                {r.run_name || "Run"} · {r.status}
              </button>
            ))}
          </div>
        )}
      </div>

      {run && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">{run.run_name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {run.source_type === "url" ? run.seed_url : run.source_type === "brief" ? "Brief-driven run" : "ICP-driven run"}
                {" · "}{run.max_accounts} accounts requested
              </p>
            </div>
            <span className="text-xs rounded-full bg-slate-100 text-slate-600 px-3 py-1 inline-flex items-center gap-1.5">
              {working && <Loader2 className="w-3 h-3 animate-spin" />}
              {run.status}
            </span>
          </div>

          <AgentRunProgress run={run} session={session} />

          {run.profile?.summary && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-1.5">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Working profile</p>
              <p className="text-sm text-slate-700 leading-relaxed">{run.profile.summary}</p>
              {run.campaign_intel && (
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">Campaign angle:</strong> {run.campaign_intel}
                </p>
              )}
              {!!run.profile.buyer_roles?.length && (
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">Buyer roles:</strong> {run.profile.buyer_roles.join(", ")}
                </p>
              )}
            </div>
          )}

          {note && <p className="text-sm text-emerald-700">{note}</p>}

          {!!run.candidates?.length && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                Accounts — include or remove before you call
              </p>
              <AgentCandidateList candidates={run.candidates} onToggle={toggleCandidate} busyKey={busyKey} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}