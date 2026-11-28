import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import AgentSourceTabs from "@/components/prospecting/agent/AgentSourceTabs";
import DictateButton from "@/components/dialer/DictateButton";
import GeographySelector from "@/components/prospecting/GeographySelector";

const COUNTS = [5, 10, 20, 30];

export default function AgentRunForm({ config, setConfig, lists, onStart, starting, error }) {
  const needsUrl = config.source_type === "url";
  const needsIcp = config.source_type === "icp";
  const needsBrief = config.source_type === "brief";
  const ready = needsUrl
    ? !!config.seed_url.trim()
    : needsIcp
      ? !!config.icp.trim()
      : !!config.brief.trim();

  return (
    <div className="space-y-4">
      <AgentSourceTabs value={config.source_type} onChange={(v) => setConfig({ ...config, source_type: v })} />

      {needsUrl && (
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-slate-400">Account URL</label>
          <Input
            value={config.seed_url}
            onChange={(e) => setConfig({ ...config, seed_url: e.target.value })}
            placeholder="https://example-client.co.uk"
            className="rounded-xl"
          />
          <p className="text-[11px] text-slate-400">
            The agent reads the site, infers the ideal customer profile, then finds similar accounts.
          </p>
        </div>
      )}

      {(needsBrief || needsIcp) && (
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-slate-400">
            {needsBrief ? "Campaign brief" : "Ideal customer profile"}
          </label>
          <Textarea
            value={needsBrief ? config.brief : config.icp}
            onChange={(e) =>
              setConfig({ ...config, [needsBrief ? "brief" : "icp"]: e.target.value })
            }
            placeholder={
              needsBrief
                ? "What we sell, to whom, why now, the offer, and anything that disqualifies an account…"
                : "Industry, company size, geography, target roles and buying signals…"
            }
            className="rounded-xl min-h-28 text-sm"
          />
          <DictateButton
            value={needsBrief ? config.brief : config.icp}
            onChange={(v) => setConfig({ ...config, [needsBrief ? "brief" : "icp"]: v })}
            label={needsBrief ? "Dictate brief" : "Dictate ICP"}
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-slate-400">Accounts to find</label>
          <div className="relative">
            <select
              value={config.max_accounts}
              onChange={(e) => setConfig({ ...config, max_accounts: Number(e.target.value) })}
              className="appearance-none w-full rounded-xl border border-slate-200 bg-white pl-4 pr-9 py-2 text-sm text-slate-700"
            >
              {COUNTS.map((c) => (
                <option key={c} value={c}>{c} accounts</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-slate-400">Save into</label>
          <div className="relative">
            <select
              value={config.prospect_list_id}
              onChange={(e) => setConfig({ ...config, prospect_list_id: e.target.value })}
              className="appearance-none w-full rounded-xl border border-slate-200 bg-white pl-4 pr-9 py-2 text-sm text-slate-700"
            >
              <option value="">New list for this run</option>
              {(lists || []).map((l) => (
                <option key={l.id} value={l.id}>{l.name?.trim() || "Untitled list"}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <GeographySelector
        permittedCountries={config.permitted_countries}
        onChange={(v) => setConfig({ ...config, permitted_countries: v })}
      />

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={config.auto_enrich}
          onChange={(e) => setConfig({ ...config, auto_enrich: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">Enrich decision-makers automatically</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Uses your connected providers in priority order and respects spending limits. Costs provider credits.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button
        onClick={onStart}
        disabled={!ready || starting}
        className="rounded-full bg-emerald-600 hover:bg-emerald-700 w-full"
      >
        {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {starting ? "Starting the agent…" : "Start prospecting"}
      </Button>
    </div>
  );
}