import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { BrainCircuit, CircleAlert, ExternalLink, Loader2, Sparkles, Users } from "lucide-react";
import ResearchInstructionCard from "./ResearchInstructionCard";
import ResearchRunProgress from "./ResearchRunProgress";
import ResearchImportPanel from "@/components/prospecting/ResearchImportPanel";
import AccountResearchDetail from "@/components/prospecting/AccountResearchDetail";
import ResearchCriteriaPills, { composeInstruction } from "./ResearchCriteriaPills";

const PROVIDERS = [
  { id: "gemini", label: "Gemini web (default)" },
  { id: "openai_web", label: "OpenAI web search (opt-in)" },
];

const normalise = (value) => String(value || "").trim().toLowerCase();

// The campaign Research workspace: one instruction, saved and reusable, applied
// to all / selected / missing accounts, with per-account progress kept in the
// database so nothing is lost when you navigate away. Built on the same
// AccountResearch records the prospecting page and the dialer read.
export default function CampaignResearchWorkspace({ campaignId }) {
  const { user } = useAuth();
  const [listId, setListId] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [prospects, setProspects] = useState([]);
  const [records, setRecords] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [run, setRun] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [criteria, setCriteria] = useState([]);
  const [provider, setProvider] = useState("gemini");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openRecord, setOpenRecord] = useState(null);
  const stopRef = useRef(false);

  const loadResearch = useCallback(async (id) => {
    const [rows, research] = await Promise.all([
      base44.entities.Prospect.filter({ list_id: id }, "-created_date", 500).catch(() => []),
      base44.entities.AccountResearch.filter({ prospect_list_id: id }, "-researched_at", 300).catch(() => []),
    ]);
    setProspects(rows || []);
    setRecords(research || []);
  }, []);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError("");
    try {
      const lists = await base44.entities.ProspectList
        .filter({ campaign_id: campaignId }, "-created_date", 1)
        .catch(() => []);
      const list = lists?.[0];
      const [savedBriefs, runs] = await Promise.all([
        base44.entities.ResearchBrief.list("-created_date", 50).catch(() => []),
        list
          ? base44.entities.ResearchRun.filter({ prospect_list_id: list.id }, "-created_date", 5).catch(() => [])
          : Promise.resolve([]),
      ]);
      setBriefs(savedBriefs || []);
      setRun((runs || []).find((item) => ["queued", "processing"].includes(item.status)) || (runs || [])[0] || null);

      if (!list) {
        setListId("");
        setProspects([]);
        setRecords([]);
        setSetupNeeded(true);
        return;
      }
      setListId(list.id);
      setSetupNeeded(false);
      await loadResearch(list.id);
    } catch (e) {
      setError(e.message || "Could not load the research workspace.");
    } finally {
      setLoading(false);
    }
  }, [campaignId, loadResearch]);

  useEffect(() => {
    load();
  }, [load]);

  const setUp = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await base44.functions.invoke("ensureCampaignResearchList", { campaign_id: campaignId });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setMessage(
        `${data.total_accounts} account${data.total_accounts === 1 ? "" : "s"} ready to research${
          data.created_prospects ? ` (${data.created_prospects} added from this campaign)` : ""
        }.`,
      );
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not set up research for this campaign.");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (initial) => {
    let current = initial;
    let guard = 0;
    while (current && ["queued", "processing"].includes(current.status) && guard < 500) {
      if (stopRef.current) break;
      const res = await base44.functions.invoke("researchRunStep", { run_id: current.id });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      current = data.run;
      setRun(current);
      guard += 1;
    }
    return current;
  };

  // Pills only compose the instruction; the run itself is unchanged.
  const effectiveInstruction = useMemo(() => composeInstruction(criteria, instruction), [criteria, instruction]);

  const start = async (scope) => {
    const text = effectiveInstruction.trim();
    if (!listId || !text || busy) return;
    const targetCount =
      scope === "all" ? prospects.length : scope === "selected" ? selected.length : missing.length;
    if (
      !window.confirm(
        `Run paid research for ${targetCount} account${targetCount === 1 ? "" : "s"}?\n\n` +
          `About ${targetCount} Smart Action${targetCount === 1 ? "" : "s"} will be used — one per account on ` +
          `${provider === "openai_web" ? "OpenAI web search" : "Gemini web"}. ` +
          `Existing findings are reused, and nothing is emailed.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    stopRef.current = false;
    try {
      const res = await base44.functions.invoke("startResearchRun", {
        prospect_list_id: listId,
        instruction: text,
        scope,
        provider,
        prospect_ids: scope === "selected" ? selected : [],
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      if (!data.run) {
        setMessage(data.message || "Nothing to research.");
        return;
      }
      setRun(data.run);
      const finished = await advance(data.run);
      if (finished && finished.status !== "cancelled") {
        setMessage(
          `${finished.completed_accounts || 0} account${finished.completed_accounts === 1 ? "" : "s"} researched${
            finished.failed_accounts ? `, ${finished.failed_accounts} failed` : ""
          }.`,
        );
      }
      await loadResearch(listId);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Research could not start.");
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError("");
    stopRef.current = false;
    try {
      const res = await base44.functions.invoke("researchRunStep", { run_id: run.id, retry: true });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setRun(data.run);
      await advance(data.run);
      await loadResearch(listId);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not retry.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!run) return;
    stopRef.current = true;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("researchRunStep", { run_id: run.id, cancel: true });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setRun(data.run);
      setMessage("Research stopped. Finished accounts kept their findings.");
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not stop the run.");
    } finally {
      setBusy(false);
    }
  };

  const saveBrief = async (name) => {
    const created = await base44.entities.ResearchBrief.create({
      name,
      instruction: effectiveInstruction.trim(),
      campaign_id: campaignId,
      organisation_id: user?.organisation_id,
      created_by_user_id: user?.id,
    });
    setBriefs((items) => [created, ...items]);
    setMessage(`Brief “${name}” saved — reuse it on any campaign.`);
  };

  const loadBrief = async (brief) => {
    setCriteria([]);
    setInstruction(brief.instruction || "");
    setMessage(`Loaded “${brief.name}”.`);
    await base44.entities.ResearchBrief
      .update(brief.id, { use_count: (brief.use_count || 0) + 1, last_used_at: new Date().toISOString() })
      .catch(() => {});
  };

  const deleteBrief = async (brief) => {
    await base44.entities.ResearchBrief.delete(brief.id);
    setBriefs((items) => items.filter((item) => item.id !== brief.id));
  };

  const recordsByProspect = useMemo(() => {
    const map = new Map();
    [...records]
      .sort((a, b) => String(b.researched_at || "").localeCompare(String(a.researched_at || "")))
      .forEach((record) => {
        if (!map.has(record.prospect_id)) map.set(record.prospect_id, record);
      });
    return map;
  }, [records]);

  const coveredForInstruction = useMemo(() => {
    const wanted = normalise(effectiveInstruction);
    const source = wanted ? records.filter((record) => normalise(record.prompt) === wanted) : records;
    return new Set(source.map((record) => record.prospect_id));
  }, [records, effectiveInstruction]);

  const missing = prospects.filter((prospect) => !coveredForInstruction.has(prospect.id));
  const active = ["queued", "processing"].includes(run?.status);
  const disabled = busy || active;
  const visible = prospects.slice(0, 100);

  const toggle = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-emerald-600 text-white">
          <BrainCircuit className="w-5 h-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Research workspace</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Say once what to find out. Cadence researches every account from public sources, keeps the source link with
            each finding, and keeps published evidence separate from anything the customer confirms. Everything here is
            also visible on the call.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading research…
        </p>
      ) : setupNeeded ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm text-slate-600">
            This campaign has no research list yet. Set one up and every company in the campaign becomes an account you
            can research — nothing is duplicated if you run it again.
          </p>
          <Button onClick={setUp} disabled={busy} className="rounded-full bg-emerald-600 hover:bg-emerald-500">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Set up research for this campaign
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">What to research</p>
              <ResearchCriteriaPills value={criteria} onChange={setCriteria} disabled={disabled} />
            </div>
            <ResearchInstructionCard
              value={instruction}
              onChange={setInstruction}
              briefs={briefs}
              onSave={saveBrief}
              onLoad={loadBrief}
              onDelete={deleteBrief}
              disabled={disabled}
            />

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] uppercase tracking-widest text-slate-400">Provider</span>
              {PROVIDERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setProvider(option.id)}
                  disabled={disabled}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    provider === option.id
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              ))}
              <span className="text-[11px] text-slate-400">
                One Smart Action per account · OpenAI falls back to Gemini if it is unavailable
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <Button
                onClick={() => start("all")}
                disabled={disabled || !effectiveInstruction.trim() || !prospects.length}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500"
              >
                {busy && !active ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                Research all {prospects.length ? `(${prospects.length})` : ""}
              </Button>
              <Button
                onClick={() => start("selected")}
                disabled={disabled || !effectiveInstruction.trim() || !selected.length}
                variant="outline"
                className="rounded-full border-slate-300"
              >
                Research selected {selected.length ? `(${selected.length})` : ""}
              </Button>
              <Button
                onClick={() => start("missing")}
                disabled={disabled || !effectiveInstruction.trim() || !missing.length}
                variant="outline"
                className="rounded-full border-slate-300"
              >
                Research missing {missing.length ? `(${missing.length})` : ""}
              </Button>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5" /> {coveredForInstruction.size} of {prospects.length} accounts researched
                {instruction.trim() ? " for this instruction" : ""}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-medium">Cost estimate: 1 Smart Action per account</span>
              <span>All {prospects.length} ≈ {prospects.length}</span>
              <span>Selected {selected.length} ≈ {selected.length}</span>
              <span>Missing {missing.length} ≈ {missing.length}</span>
              <span className="text-slate-400">Nothing is charged until you approve the run.</span>
            </div>
          </div>

          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <CircleAlert className="w-4 h-4 mt-0.5 flex-none" /> {error}
            </p>
          )}

          <ResearchRunProgress
            run={run}
            busy={busy}
            onRetry={retry}
            onCancel={cancel}
            onOpenRecord={(prospectId) => setOpenRecord(recordsByProspect.get(prospectId) || null)}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">Accounts</p>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Clear {selected.length} selected
                </button>
              )}
            </div>
            <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {visible.map((prospect) => {
                const record = recordsByProspect.get(prospect.id);
                const covered = coveredForInstruction.has(prospect.id);
                return (
                  <li key={prospect.id} className="flex items-center gap-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(prospect.id)}
                      onChange={() => toggle(prospect.id)}
                      disabled={disabled}
                      aria-label={`Select ${prospect.company_name}`}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{prospect.company_name}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        covered
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {covered ? "researched" : "not yet"}
                    </span>
                    {record && (
                      <span className="text-[11px] text-slate-400">
                        {(record.findings || []).length} finding{(record.findings || []).length === 1 ? "" : "s"} ·{" "}
                        {record.source_count || 0} source{(record.source_count || 0) === 1 ? "" : "s"}
                      </span>
                    )}
                    {record && (
                      <button
                        type="button"
                        onClick={() => setOpenRecord(record)}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {prospects.length > visible.length && (
              <p className="mt-2 text-[11px] text-slate-400">
                Showing the first {visible.length} of {prospects.length} accounts — research still covers them all.
              </p>
            )}
          </div>

          <ResearchImportPanel
            listId={listId}
            prospects={prospects}
            onImported={() => loadResearch(listId)}
          />
        </>
      )}

      <AccountResearchDetail
        record={openRecord}
        onClose={() => setOpenRecord(null)}
        onRecordUpdated={(updated) => {
          setOpenRecord(updated);
          setRecords((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        }}
      />
    </div>
  );
}