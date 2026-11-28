import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";
import {
  Loader2, Users, Split, MapPin, Building2, Sparkles, Check, X,
} from "lucide-react";
import {
  UK_TERRITORIES,
  bucketByTerritory,
  bucketByIndustry,
  splitEven,
  assignBucketsRoundRobin,
  assignByTerritoryMap,
  parseSplitInstruction,
  summariseSplit,
  toManualAssignments,
} from "@/lib/splitCampaignData";

const MODES = [
  { id: "even", label: "Even / 50-50", detail: "Mixed spread across selected people", icon: Split },
  { id: "by_territory", label: "By territory", detail: "North West, South East, Scotland…", icon: MapPin },
  { id: "by_industry", label: "By industry", detail: "Keep sectors together per person", icon: Building2 },
  { id: "dictate", label: "Dictate / describe", detail: "Type or speak how to split", icon: Sparkles },
];

export default function SplitCampaignData({
  campaign,
  callers = [],
  open,
  onClose,
  onDone,
}) {
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState("even");
  const [instruction, setInstruction] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [territoryMap, setTerritoryMap] = useState({});

  useEffect(() => {
    if (!open || !campaign?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setResult(null);
      try {
        const [assignments, members, lists] = await Promise.all([
          base44.entities.CampaignAssignment.filter({ campaign_id: campaign.id }, "-created_date", 1000).catch(() => []),
          base44.entities.TargetListMember.filter({ target_list_id: campaign.id }, "-created_date", 1000).catch(() => []),
          base44.entities.ProspectList.filter({ campaign_id: campaign.id }, "-created_date", 20).catch(() => []),
        ]);
        const companyIds = new Set([
          ...(assignments || []).map((a) => a.company_id),
          ...(members || []).map((m) => m.company_id),
        ].filter(Boolean));

        // Seed prospects (Find prospects import) may not be Companies yet —
        // surface them for preview; the server creates Companies on apply.
        const prospectAccounts = [];
        for (const list of lists || []) {
          const prospects = await base44.entities.Prospect.filter({ list_id: list.id }, "-created_date", 1000).catch(() => []);
          for (const prospect of prospects || []) {
            if (!prospect.company_name) continue;
            prospectAccounts.push({
              id: prospect.id,
              company_id: "",
              name: prospect.company_name,
              industry: prospect.industry || "",
              location: prospect.location || "",
              from_prospect: true,
            });
          }
        }

        const companies = [];
        const ids = [...companyIds];
        for (let i = 0; i < ids.length; i += 40) {
          const slice = ids.slice(i, i + 40);
          const rows = await Promise.all(slice.map((id) => base44.entities.Company.get(id).catch(() => null)));
          rows.filter(Boolean).forEach((company) => {
            companies.push({
              id: company.id,
              company_id: company.id,
              name: company.name,
              industry: company.industry || "",
              location: company.location || company.territory || "",
            });
          });
        }

        // Prefer Company records; add prospect-only names not already present.
        const known = new Set(companies.map((c) => (c.name || "").toLowerCase()));
        for (const row of prospectAccounts) {
          if (!known.has((row.name || "").toLowerCase())) {
            companies.push(row);
            known.add((row.name || "").toLowerCase());
          }
        }

        if (!cancelled) {
          setAccounts(companies);
          if (callers.length >= 2) {
            setSelected(callers.slice(0, 2).map((c) => c.user_id));
            setTerritoryMap({
              [callers[0].user_id]: ["northwest", "northeast", "yorkshire", "scotland"],
              [callers[1].user_id]: ["southeast", "southwest", "midlands", "wales", "northern_ireland"],
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load campaign accounts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, campaign?.id, callers]);

  const toggle = (userId) => {
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const previewPiles = useMemo(() => {
    const people = callers.filter((c) => selected.includes(c.user_id));
    if (!people.length || !accounts.length) return [];
    if (mode === "even") return splitEven(accounts, selected);
    if (mode === "by_industry") return assignBucketsRoundRobin(bucketByIndustry(accounts), selected);
    if (mode === "by_territory") {
      const map = selected.map((userId) => ({
        userId,
        territories: territoryMap[userId] || [],
      }));
      if (map.some((row) => row.territories.length)) return assignByTerritoryMap(accounts, map);
      return assignBucketsRoundRobin(bucketByTerritory(accounts), selected);
    }
    if (mode === "dictate") {
      const parsed = parseSplitInstruction(instruction, people);
      if (parsed?.mode === "even") return splitEven(accounts, selected);
      if (parsed?.mode === "by_industry") return assignBucketsRoundRobin(bucketByIndustry(accounts), selected);
      if (parsed?.mode === "by_territory" && parsed.territoryMap) {
        return assignByTerritoryMap(accounts, parsed.territoryMap);
      }
      if (parsed?.mode === "by_territory") return assignBucketsRoundRobin(bucketByTerritory(accounts), selected);
      return splitEven(accounts, selected);
    }
    return [];
  }, [mode, accounts, selected, callers, territoryMap, instruction]);

  const summary = summariseSplit(previewPiles, callers);
  const territoryBuckets = useMemo(() => bucketByTerritory(accounts), [accounts]);
  const industryBuckets = useMemo(() => bucketByIndustry(accounts).slice(0, 8), [accounts]);

  const apply = async () => {
    if (!campaign?.id || selected.length < 1) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const parsed = mode === "dictate" ? parseSplitInstruction(instruction, callers.filter((c) => selected.includes(c.user_id))) : null;
      const method =
        mode === "even" ? "even_distribution"
          : mode === "by_industry" ? "by_industry"
            : mode === "by_territory" ? "by_territory"
              : parsed?.mode === "even" ? "even_distribution"
                : parsed?.mode === "by_industry" ? "by_industry"
                  : parsed?.mode === "by_territory" ? "by_territory"
                    : "ai_instructed";

      const payload = {
        campaign_id: campaign.id,
        method,
        user_ids: selected,
        reassign_existing: true,
      };

      if (method === "by_territory") {
        payload.territory_map = selected.map((userId) => ({
          userId,
          territories: (parsed?.territoryMap || []).find((row) => row.userId === userId)?.territories
            || territoryMap[userId]
            || [],
        }));
      }

      if (method === "ai_instructed") {
        payload.instruction = instruction;
        // Also send a deterministic preview when we have company ids already.
        const withIds = previewPiles.every((pile) => (pile.accounts || []).every((a) => a.company_id || a.id));
        if (withIds && !previewPiles.some((pile) => (pile.accounts || []).some((a) => a.from_prospect))) {
          payload.manual_assignments = toManualAssignments(previewPiles);
        }
      }

      const res = await base44.functions.invoke("assignCampaignCompanies", payload);
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult(data);
      onDone?.(data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not split this campaign.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Split campaign data
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              Share “{campaign?.name}” across the team
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Split by territory, industry, evenly, or describe it in plain English.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {accounts.length} account{accounts.length === 1 ? "" : "s"} ready to split
              {territoryBuckets.length ? ` · ${territoryBuckets.length} territory bucket${territoryBuckets.length === 1 ? "" : "s"}` : ""}
              {industryBuckets.length ? ` · top industries: ${industryBuckets.slice(0, 3).map((b) => b.label).join(", ")}` : ""}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">Who gets the work?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {callers.map((caller) => {
                  const active = selected.includes(caller.user_id);
                  return (
                    <button
                      key={caller.user_id}
                      type="button"
                      onClick={() => toggle(caller.user_id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                        active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <Users className="h-4 w-4 text-slate-400" />
                        {caller.full_name || caller.email}
                      </span>
                      {active && <Check className="h-4 w-4 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
              {!callers.length && (
                <p className="text-sm text-slate-400">No active callers found. Invite the team first.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">How should Cadence split it?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODES.map((item) => {
                  const Icon = item.icon;
                  const active = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMode(item.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Icon className="h-4 w-4 text-emerald-600" />
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{item.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "by_territory" && selected.length > 0 && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Assign territories
                </p>
                {selected.map((userId) => {
                  const person = callers.find((c) => c.user_id === userId);
                  const chosen = territoryMap[userId] || [];
                  return (
                    <div key={userId}>
                      <p className="mb-1.5 text-sm font-medium text-slate-800">{person?.full_name || "Caller"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {UK_TERRITORIES.map((territory) => {
                          const on = chosen.includes(territory.id);
                          const count = territoryBuckets.find((b) => b.id === territory.id)?.accounts.length || 0;
                          return (
                            <button
                              key={territory.id}
                              type="button"
                              onClick={() => {
                                setTerritoryMap((current) => {
                                  const next = new Set(current[userId] || []);
                                  on ? next.delete(territory.id) : next.add(territory.id);
                                  return { ...current, [userId]: [...next] };
                                });
                              }}
                              className={`rounded-full px-2.5 py-1 text-xs ${
                                on ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {territory.label}{count ? ` (${count})` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mode === "dictate" && (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder='e.g. “Split 50/50 between Aileen and Malcolm” or “Aileen takes North West and Scotland, Malcolm takes South East and Midlands”'
                  className="rounded-xl"
                />
                <DictateButton value={instruction} onChange={setInstruction} label="Dictate split" />
              </div>
            )}

            {summary.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Preview</p>
                <ul className="mt-2 space-y-1.5">
                  {summary.map((row) => (
                    <li key={row.userId} className="flex items-center justify-between text-sm text-slate-800">
                      <span>{row.name}</span>
                      <span className="font-semibold">{row.count} account{row.count === 1 ? "" : "s"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {result && !error && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Split applied — {result.created || 0} new, {result.updated || 0} moved
                {result.per_user
                  ? ` · ${Object.entries(result.per_user).map(([id, count]) => {
                    const name = callers.find((c) => c.user_id === id)?.full_name || "Caller";
                    return `${name} ${count}`;
                  }).join(", ")}`
                  : ""}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" className="rounded-full" onClick={onClose}>Close</Button>
              <Button
                className="rounded-full bg-emerald-600 hover:bg-emerald-500"
                disabled={busy || selected.length < 1 || !accounts.length}
                onClick={apply}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Split className="mr-2 h-4 w-4" />}
                Split data
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
