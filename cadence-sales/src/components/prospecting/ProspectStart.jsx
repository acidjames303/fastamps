import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadCloud, Sparkles, Loader2, CircleAlert, CheckCircle2, MessageSquare, Search, ClipboardCheck,
} from "lucide-react";
import WorkbookImport from "@/components/prospecting/WorkbookImport";
import DictateButton from "@/components/dialer/DictateButton";
import CampaignChat from "@/components/prospecting/CampaignChat";

const IN_FLIGHT = ["queued", "researching", "discovering", "saving"];
const MIN_ACCOUNTS = 5;
const MAX_ACCOUNTS = 500;
const MAX_STEPS = 60;
const RESEARCH_BATCH = 4;
const RESEARCH_EXAMPLE =
  "Record the source link, supplier, contract scope and dates. Keep published findings separate from anything confirmed by the customer.";

const PHASE_LABEL = {
  queued: "Starting the agent…",
  researching: "Researching your market…",
  discovering: "Finding matching accounts…",
  saving: "Saving qualified accounts…",
};

const MODES = [
  { id: "chat", label: "Talk it through", icon: MessageSquare },
  { id: "upload", label: "Upload a spreadsheet", icon: UploadCloud },
  { id: "prompt", label: "Type it in one box", icon: Sparkles },
];

const STEPS = [
  { icon: MessageSquare, label: "Describe the campaign" },
  { icon: Search, label: "Cadence finds the accounts" },
  { icon: ClipboardCheck, label: "Review, enrich, push" },
];

// One entry point for prospecting: talk the campaign through, drop in a
// spreadsheet, or describe it in a single box. All three land in a prospect
// list that is ready to research and enrich.
export default function ProspectStart({ listId, prospects = [], onListCreated, onImported, onRunFinished }) {
  const [mode, setMode] = useState("chat");
  const [prompt, setPrompt] = useState("");
  const [brief, setBrief] = useState("");
  const [icp, setIcp] = useState("");
  const [count, setCount] = useState(25);
  const [found, setFound] = useState(0);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);
  const [instruction, setInstruction] = useState(RESEARCH_EXAMPLE);
  const [research, setResearch] = useState({ done: 0, total: 0 });

  // A run starts from the conversation (written brief + ICP) or from the
  // single-box description. Both use the same agent.
  const runWith = async ({ brief: runBrief = "", icp: runIcp = "", research: runResearch = true } = {}) => {
    const useBrief = runBrief.trim();
    const useIcp = runIcp.trim() || (useBrief ? "" : prompt.trim());
    if ((!useBrief && !useIcp) || starting) return;
    setBrief(useBrief);
    setIcp(useIcp);
    setStarting(true);
    setError("");
    setSaved(null);
    setFound(0);
    setResearch({ done: 0, total: 0 });
    setPhase(PHASE_LABEL.queued);
    const target = Math.min(MAX_ACCOUNTS, Math.max(MIN_ACCOUNTS, Math.round(count) || MIN_ACCOUNTS));
    try {
      const started = await base44.functions.invoke("startProspectingRun", {
        source_type: useBrief ? "brief" : "icp",
        brief: useBrief,
        icp: useIcp,
        max_accounts: target,
        permitted_countries: ["GB"],
        auto_enrich: false,
        prospect_list_id: listId || undefined,
      });
      const data = started.data || started;
      if (data?.error) throw new Error(data.error);

      let current = data.run;
      let guard = 0;
      // Large runs (100+) are built up over several discovery rounds, so keep
      // stepping until the agent finishes instead of stopping after a few calls.
      while (current && IN_FLIGHT.includes(current.status) && guard < MAX_STEPS) {
        setPhase(PHASE_LABEL[current.status] || "Working…");
        setFound(current.accounts_found || current.prospect_ids?.length || 0);
        const step = await base44.functions.invoke("runProspectingStep", { run_id: current.id });
        const stepData = step.data || step;
        if (stepData?.error) throw new Error(stepData.error);
        current = stepData.run;
        guard += 1;
      }
      if (current?.status === "failed") {
        throw new Error(current.error_summary || "The agent could not finish this run.");
      }

      const found = current?.prospect_ids?.length || 0;
      setSaved({ found });
      setPrompt("");

      // Research the accounts the agent just found, applying the written
      // instruction to each one before the list opens.
      const ids = current?.prospect_ids || [];
      const targetListId = current?.prospect_list_id;
      const text = runResearch ? instruction.trim() : "";
      if (text && ids.length && targetListId) {
        try {
          setResearch({ done: 0, total: ids.length });
          let researched = 0;
          for (let i = 0; i < ids.length; i += RESEARCH_BATCH) {
            setPhase(`Researching accounts — ${Math.min(i + RESEARCH_BATCH, ids.length)} of ${ids.length}…`);
            const res = await base44.functions.invoke("researchAccountsPrompted", {
              prospect_list_id: targetListId,
              prompt: text,
              prospect_ids: ids.slice(i, i + RESEARCH_BATCH),
            });
            const data = res.data || res;
            if (data?.error) throw new Error(data.error);
            researched += data?.researched || 0;
            setResearch({ done: Math.min(i + RESEARCH_BATCH, ids.length), total: ids.length });
          }
          setSaved({ found, researched });
        } catch (researchError) {
          setError(
            `${found} account${found === 1 ? "" : "s"} saved, but research stopped: ${
              researchError?.response?.data?.error || researchError.message
            }`,
          );
        }
      }

      await onRunFinished?.(current);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "The agent could not finish this run.");
    } finally {
      setStarting(false);
      setPhase("");
    }
  };

  const run = () => runWith({ icp: prompt });

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-slate-900">Start prospecting</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xl">
          Talk the campaign through like you would with a colleague. Cadence writes the brief as you go, then finds
          the accounts that fit. Prefer to bring your own list? Upload a spreadsheet instead.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <React.Fragment key={step.label}>
              {i > 0 && <span className="text-slate-300">→</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1">
                <Icon className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-600">{i + 1}. {step.label}</span>
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {m.label}
            </button>
          );
        })}
      </div>

      {mode === "upload" ? (
        <WorkbookImport
          listId={listId}
          onListCreated={onListCreated}
          onImported={onImported}
        />
      ) : mode === "chat" ? (
        <CampaignChat starting={starting} onStart={(payload) => runWith(payload)} initialBrief={brief} initialIcp={icp} />
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="prospect-prompt" className="text-xs uppercase tracking-widest text-slate-400">
              Who do you want to call?
            </label>
            <Textarea
              id="prospect-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. UK commercial laundry operators running 100+ sites, where maintenance is managed in-house — we sell planned maintenance cover."
              className="rounded-xl min-h-28 text-sm"
              disabled={starting}
            />
            <DictateButton value={prompt} onChange={setPrompt} label="Dictate who to call" />
            <p className="text-[11px] text-slate-400">
              Describe the market, size, location and the roles worth calling. The agent reads public sources, qualifies
              each account against your description and keeps the ones that fit.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prospect-research" className="text-xs uppercase tracking-widest text-slate-400">
              What should the agent record about each account?
            </label>
            <Textarea
              id="prospect-research"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={RESEARCH_EXAMPLE}
              className="rounded-xl min-h-20 text-sm"
              disabled={starting}
            />
            <DictateButton value={instruction} onChange={setInstruction} label="Dictate research instruction" />
            <p className="text-[11px] text-slate-400">
              Runs on every account the agent finds, with the source link kept beside each finding. One Smart Action per
              account — leave it blank to find accounts without research.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5 sm:w-52">
              <label htmlFor="prospect-count" className="text-xs uppercase tracking-widest text-slate-400">Accounts</label>
              <input
                id="prospect-count"
                type="number"
                min={MIN_ACCOUNTS}
                max={MAX_ACCOUNTS}
                step={5}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={starting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              />
              <p className="text-[11px] text-slate-400">
                {MIN_ACCOUNTS}–{MAX_ACCOUNTS}. Bigger runs are built up in rounds and take longer.
              </p>
            </div>
            <Button
              onClick={run}
              disabled={!prompt.trim() || starting}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
            >
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {starting ? "Working…" : "Find accounts"}
            </Button>
          </div>
        </div>
      )}

      {starting && phase && (
        <p className="text-sm text-slate-500 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> {phase}
          {found > 0 && <span className="text-slate-400">· {found} found so far</span>}
          {research.total > 0 && (
            <span className="text-slate-400">· {research.done} researched</span>
          )}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="w-4 h-4 mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" />
          <span>
            {saved.found
              ? `${saved.found} account${saved.found === 1 ? "" : "s"} saved${
                  saved.researched ? ` and ${saved.researched} researched` : ""
                }. Enrich them next.`
              : "The agent finished but nothing fitted your description. Try naming the market, size or buying signals."}
          </span>
        </div>
      )}
    </div>
  );
}