import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrainCircuit, CircleAlert, Loader2, Square } from "lucide-react";

const BATCH = 4;

const EXAMPLE =
  "For each account, record the source link, supplier, contract scope and dates. Keep published findings separate from anything confirmed by the customer.";

// Prompt-driven research across every account in the list: one instruction,
// sourced findings stored per account, downloadable and usable by Lusha.
export default function ResearchPromptPanel({ listId, prospects = [], onChanged, onResearchLoaded }) {
  const [prompt, setPrompt] = useState("");
  const [records, setRecords] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const stopRef = useRef(false);

  const loadRecords = async () => {
    if (!listId) { setRecords([]); onResearchLoaded?.([]); return; }
    const found = await base44.entities.AccountResearch
      .filter({ prospect_list_id: listId }, "-researched_at", 200)
      .catch(() => []);
    setRecords(found || []);
    onResearchLoaded?.(found || []);
  };

  // Reload when accounts change too, so research run during a discovery shows up.
  useEffect(() => { loadRecords(); }, [listId, prospects.length]);

  const instruction = prompt.trim();
  const covered = new Set(
    records.filter((r) => (r.prompt || "").trim().toLowerCase() === instruction.toLowerCase()).map((r) => r.prospect_id),
  );
  const pending = prospects.filter((p) => !covered.has(p.id));

  const run = async () => {
    if (!instruction || running || !listId) return;
    const ids = pending.map((p) => p.id);
    if (!ids.length) return;
    stopRef.current = false;
    setRunning(true);
    setError("");
    setProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        if (stopRef.current) break;
        const res = await base44.functions.invoke("researchAccountsPrompted", {
          prospect_list_id: listId,
          prompt: instruction,
          prospect_ids: ids.slice(i, i + BATCH),
        });
        const data = res.data || res;
        if (data?.error) throw new Error(data.error);
        if (data?.results?.some((r) => r.error && !r.findings)) {
          const firstError = data.results.find((r) => r.error);
          if (String(firstError.error).includes("allowance")) throw new Error(firstError.error);
        }
        setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
        await loadRecords();
      }
      await onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Research stopped. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  };

  if (!listId || !prospects.length) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start gap-2">
        <BrainCircuit className="w-4 h-4 mt-0.5 flex-none text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Prompt your accounts</p>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Write the instruction once. Cadence researches every account in this list from public sources, records the
            source link with each finding, and keeps published research separate from anything the customer confirms.
          </p>
        </div>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={EXAMPLE}
        rows={4}
        disabled={running}
        className="rounded-xl text-sm"
      />
      <p className="text-[11px] text-slate-400">
        One Smart Action per account · re-running the same instruction refreshes its findings instead of duplicating them.
      </p>

      {running && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {progress.done} of {progress.total} accounts researched — you can carry on with your day.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <CircleAlert className="w-4 h-4 mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={run}
          disabled={!instruction || running || !pending.length}
          className="rounded-full bg-emerald-600 hover:bg-emerald-500"
        >
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
          {running
            ? "Researching…"
            : pending.length
              ? `Research ${pending.length} account${pending.length === 1 ? "" : "s"}`
              : "Every account researched for this instruction"}
        </Button>
        {running && (
          <Button variant="outline" className="rounded-full border-slate-300" onClick={() => { stopRef.current = true; }}>
            <Square className="w-3.5 h-3.5 mr-1.5" /> Stop
          </Button>
        )}
      </div>

      {records.length > 0 && (
        <p className="text-[11px] text-slate-400">
          {records.length} account{records.length === 1 ? "" : "s"} researched — open “see research” on a row to read the findings.
        </p>
      )}
    </div>
  );
}