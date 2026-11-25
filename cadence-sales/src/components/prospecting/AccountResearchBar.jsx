import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit, ArrowRight, CircleAlert, Search } from "lucide-react";

const BATCH = 5;
const DEFAULT_PROMPT =
  "For each account, record industry, size, location, website, switchboard, buyer signals and the roles worth calling. Keep published findings separate from anything confirmed by the customer.";

// Step two of the prospecting flow: AI account research runs before any
// provider credits are spent, so Lusha/Apollo are asked about the right
// people at the right company. Supports a first pass and dig-deeper.
export default function AccountResearchBar({ listId, prospects = [], onResearched, onFindContacts, embedded = false }) {
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState("standard");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  // A prospect counts as researched once AI has been over it — including when
  // research ran but could not confirm the company (provider_used === ai_web),
  // so the same account is never researched twice on the first pass.
  const pending = prospects.filter((p) => !p.company_found && p.provider_used !== "ai_web");
  const researched = prospects.filter((p) => p.company_found || p.provider_used === "ai_web");

  const runBatch = async (ids, runMode) => {
    if (!ids.length || running || !listId) return;
    setRunning(true);
    setMode(runMode);
    setError("");
    setDone(0);
    setTotal(ids.length);
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        if (runMode === "deeper") {
          const res = await base44.functions.invoke("researchAccountsPrompted", {
            prospect_list_id: listId,
            prospect_ids: chunk,
            prompt: DEFAULT_PROMPT,
            mode: "deeper",
          });
          const data = res.data || res;
          if (data?.error) throw new Error(data.error);
        } else {
          const res = await base44.functions.invoke("researchAccountsBatch", {
            prospect_list_id: listId,
            prospect_ids: chunk,
          });
          const data = res.data || res;
          if (data?.error) throw new Error(data.error);
        }
        setDone(Math.min(i + chunk.length, ids.length));
        await onResearched?.();
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "AI research stopped. Try again in a moment.");
    } finally {
      setRunning(false);
      setMode("standard");
    }
  };

  const research = () => runBatch(pending.map((p) => p.id), "standard");
  const digDeeper = () => runBatch(researched.map((p) => p.id), "deeper");

  if (!listId || !prospects.length) return null;

  const allResearched = pending.length === 0;

  return (
    <div className={embedded ? "space-y-3" : "rounded-2xl border border-slate-200 bg-white p-5 space-y-3"}>
      {!embedded && (
      <div className="flex items-start gap-2">
        <BrainCircuit className="w-4 h-4 mt-0.5 flex-none text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Research accounts with AI</p>
          <p className="text-xs text-slate-500 mt-1">
            Cadence studies each company from public sources — industry, size, location, website, switchboard and the roles
            worth calling — before any provider credits are spent. Dig deeper anytime to search further without wiping your notes.
          </p>
        </div>
      </div>
      )}

      {running && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {done} of {total} {mode === "deeper" ? "searched further" : "researched"} — this runs in the background of your day.
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
          onClick={research}
          disabled={running || allResearched}
          variant={allResearched ? "outline" : "default"}
          className={allResearched ? "rounded-full border-slate-300" : "rounded-full bg-emerald-600 hover:bg-emerald-500"}
        >
          {running && mode === "standard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
          {running && mode === "standard"
            ? "Researching…"
            : allResearched
              ? "Accounts researched"
              : `Research ${pending.length} account${pending.length === 1 ? "" : "s"} with AI`}
        </Button>
        {researched.length > 0 && (
          <Button
            variant="outline"
            className="rounded-full border-emerald-300 text-emerald-700"
            disabled={running}
            onClick={digDeeper}
          >
            {running && mode === "deeper" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            {running && mode === "deeper"
              ? "Searching further…"
              : `Dig deeper on ${researched.length}`}
          </Button>
        )}
        {allResearched && (
          <Button
            variant="outline"
            className="rounded-full border-emerald-300 text-emerald-700"
            onClick={() => onFindContacts?.(prospects.map((p) => p.id))}
          >
            Find emails &amp; numbers <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
