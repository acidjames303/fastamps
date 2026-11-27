import React, { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Ban, Building2, Loader2, Search, Sparkles, Upload,
} from "lucide-react";
import {
  mergeTargetSectors,
  parseExcludedCompaniesFromSheet,
  parseExcludedCompanyLines,
  parseListIcp,
} from "@/lib/companyExclusion";
import { LOOKALIKE_BATCH_SIZE, mergeLookalikeCandidates } from "@/lib/lookalikeCandidates";
import ResearchPromptPanel from "@/components/prospecting/ResearchPromptPanel";

/**
 * Grow the campaign database from companies already imported:
 * 1) Import / maintain client exclusion list
 * 2) Find similar accounts outside seed + exclusions
 * 3) Optionally run the same research prompt on new lookalikes
 */
export default function LookalikeGrowPanel({
  listId,
  prospects = [],
  onChanged,
}) {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [icp, setIcp] = useState({});
  const [loadingIcp, setLoadingIcp] = useState(false);
  const [excludeMsg, setExcludeMsg] = useState("");
  const [excludeErr, setExcludeErr] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [seedCount, setSeedCount] = useState(0);
  const [showResearch, setShowResearch] = useState(false);
  const [addedIds, setAddedIds] = useState([]);

  const excluded = icp.excluded_companies || [];
  const sectors = icp.target_sectors || [];

  const reloadIcp = useCallback(async () => {
    if (!listId) return;
    setLoadingIcp(true);
    try {
      const list = await base44.entities.ProspectList.get(listId);
      setIcp(parseListIcp(list?.icp));
    } catch {
      setIcp({});
    } finally {
      setLoadingIcp(false);
    }
  }, [listId]);

  useEffect(() => { reloadIcp(); }, [reloadIcp]);

  const saveIcp = async (next) => {
    if (!listId) return;
    await base44.entities.ProspectList.update(listId, {
      icp: JSON.stringify(next),
    });
    setIcp(next);
  };

  const mergeExcluded = async (incoming = []) => {
    setExcludeErr("");
    const merged = parseExcludedCompanyLines([...excluded, ...incoming].join("\n"));
    await saveIcp({ ...icp, excluded_companies: merged });
    setExcludeMsg(
      `Exclusion list now has ${merged.length} compan${merged.length === 1 ? "y" : "ies"}. Lookalike search will skip them.`,
    );
  };

  const importExclusionFile = async (file) => {
    setExcludeErr("");
    setExcludeMsg("");
    if (!file || !listId) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const names = parseExcludedCompaniesFromSheet(aoa);
      if (!names.length) throw new Error("No company names found in that file.");
      await mergeExcluded(names);
    } catch (error) {
      setExcludeErr(error.message || "Could not read that exclusion list.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const seedSectorsFromProspects = async () => {
    if (!listId || !prospects.length) return;
    const hints = [];
    const counts = new Map();
    for (const p of prospects) {
      const industry = String(p.industry || "").trim();
      if (!industry) continue;
      for (const part of industry.split(/[>|/•]/).map((x) => x.trim()).filter(Boolean)) {
        counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
    for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      hints.push({ name, count });
    }
    if (!hints.length) {
      setExcludeErr("No industries on these accounts yet — import a list with industries, or set Target sectors in the campaign brief.");
      return;
    }
    const nextSectors = mergeTargetSectors(sectors, hints);
    await saveIcp({ ...icp, target_sectors: nextSectors });
    setExcludeMsg(`Target sectors updated (${nextSectors.length}). Ready to find similar companies.`);
  };

  const discover = async ({ append = true } = {}) => {
    if (!listId || discovering) return;
    setDiscovering(true);
    setErr("");
    setNote(append && candidates.length
      ? `Searching for up to ${LOOKALIKE_BATCH_SIZE} more outside your ${prospects.length} companies…`
      : `Searching for up to ${LOOKALIKE_BATCH_SIZE} lookalikes…`);
    if (!append) {
      setCandidates([]);
      setSelected(new Set());
    }
    try {
      const res = await base44.functions.invoke("discoverCompanies", {
        prospect_list_id: listId,
        count: LOOKALIKE_BATCH_SIZE,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      const incoming = data.candidates || [];
      setSeedCount(data.seed_count || prospects.length);
      setCandidates((prev) => (append ? mergeLookalikeCandidates(prev, incoming) : incoming));
      // Auto-select newly returned rows so Add is one click for a full batch.
      setSelected((prev) => {
        const next = append ? new Set(prev) : new Set();
        for (const row of incoming) {
          const key = row.domain || row.name;
          if (key) next.add(key);
        }
        return next;
      });
      setNote(
        data.note
          || (incoming.length
            ? `Found ${incoming.length}. Add them, then search again for another ${LOOKALIKE_BATCH_SIZE} outside the list.`
            : ""),
      );
      if (!incoming.length) {
        setErr("No new lookalikes this round. Try refining target sectors, then search again.");
      }
    } catch (error) {
      setErr(error?.response?.data?.error || error.message || "Lookalike search failed — try again.");
      setNote("");
    } finally {
      setDiscovering(false);
    }
  };

  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(new Set(candidates.map((c) => c.domain || c.name).filter(Boolean)));
  };

  const clearSelection = () => setSelected(new Set());

  const addSelected = async () => {
    if (!listId || !selected.size || !user?.organisation_id) return;
    setAdding(true);
    setErr("");
    try {
      const picks = candidates.filter((c) => selected.has(c.domain || c.name));
      const existing = new Set(
        prospects.map((p) => String(p.company_name || "").trim().toLowerCase()).filter(Boolean),
      );
      const fresh = picks.filter((c) => !existing.has(String(c.name || "").trim().toLowerCase()));
      if (!fresh.length) {
        setNote("All selected companies are already on this list.");
        return;
      }
      const created = await base44.entities.Prospect.bulkCreate(
        fresh.map((c) => ({
          list_id: listId,
          company_name: c.name,
          domain: c.domain || "",
          website: c.website || c.source_url || "",
          industry: c.industry || "",
          employee_range: c.employee_range || "",
          location: c.location || "",
          enrichment_status: "pending",
          fit_score: 0,
          pushed: false,
          organisation_id: user.organisation_id,
        })),
      );
      const rows = Array.isArray(created) ? created : [];
      setAddedIds(rows.map((r) => r.id).filter(Boolean));
      setCandidates([]);
      setSelected(new Set());
      setNote(
        `Added ${fresh.length} lookalike${fresh.length === 1 ? "" : "s"} to the list. Click “Find ${LOOKALIKE_BATCH_SIZE} more” for another batch outside these.`,
      );
      setShowResearch(true);
      await onChanged?.(listId);
    } catch (error) {
      setErr(error?.response?.data?.error || error.message || "Could not add lookalikes.");
    } finally {
      setAdding(false);
    }
  };

  if (!listId) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Open or create this campaign list first, then grow it with lookalikes and exclusions.
      </p>
    );
  }

  if (!prospects.length) return null;

  const researchProspects = addedIds.length
    ? prospects.filter((p) => addedIds.includes(p.id))
    : prospects;

  return (
    <div className="space-y-4 rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Grow the list
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
            Find companies like these
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Each search finds up to 100 companies outside your seed and client exclusions.
            Add what you want, then search again for another batch on top.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidates.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => discover({ append: true })}
              disabled={discovering}
              className="rounded-full border-emerald-300 bg-white text-emerald-900"
            >
              {discovering ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              {discovering ? "Searching…" : `Find ${LOOKALIKE_BATCH_SIZE} more`}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => discover({ append: candidates.length === 0 })}
            disabled={discovering}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500"
          >
            {discovering ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            {discovering
              ? `Searching up to ${LOOKALIKE_BATCH_SIZE}…`
              : candidates.length
                ? "Replace results"
                : `Find up to ${LOOKALIKE_BATCH_SIZE} similar`}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Ban className="h-3.5 w-3.5" /> Client exclusions ({excluded.length})
          </p>
          <p className="text-[11px] text-slate-500">
            Companies the client already works with — never returned as lookalikes.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-800 file:border file:border-slate-200"
            onChange={(e) => importExclusionFile(e.target.files?.[0])}
          />
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
            rows={4}
            placeholder="Or paste one company per line"
            value={excluded.join("\n")}
            onChange={(e) => setIcp((prev) => ({
              ...prev,
              excluded_companies: e.target.value.split("\n"),
            }))}
            onBlur={() => saveIcp({
              ...icp,
              excluded_companies: parseExcludedCompanyLines(excluded.join("\n")),
            })}
          />
          {loadingIcp && <p className="text-[11px] text-slate-400">Loading exclusions…</p>}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Building2 className="h-3.5 w-3.5" /> ICP from this list
          </p>
          <p className="text-[11px] text-slate-500">
            {prospects.length} seed account{prospects.length === 1 ? "" : "s"}
            {sectors.length ? ` · ${sectors.length} target sector${sectors.length === 1 ? "" : "s"}` : " · no target sectors yet"}
          </p>
          {sectors.length > 0 && (
            <p className="text-xs text-slate-600">{sectors.slice(0, 8).join(" · ")}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={seedSectorsFromProspects}
            className="rounded-full border-slate-300 bg-white"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Use industries from seed list
          </Button>
        </div>
      </div>

      {excludeMsg && <p className="text-xs text-emerald-700">{excludeMsg}</p>}
      {excludeErr && <p className="text-xs text-rose-600">{excludeErr}</p>}
      {note && <p className="text-xs text-emerald-800">{note}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}

      {candidates.length > 0 && (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              {candidates.length} lookalike{candidates.length === 1 ? "" : "s"}
              {selected.size ? ` · ${selected.size} selected` : ""}
              {seedCount ? ` · outside ${seedCount} on list` : ""}
              {excluded.length ? ` · skipping ${excluded.length} clients` : ""}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-full px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50"
              >
                Select all
              </button>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-full px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!selected.size || adding}
                onClick={addSelected}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500"
              >
                {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Add {selected.size || ""} to list
              </Button>
            </div>
          </div>
          {candidates.map((c) => {
            const key = c.domain || c.name;
            return (
              <label key={key} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(key)}
                  onChange={() => toggle(key)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900 truncate">{c.name}</span>
                  <span className="block text-xs text-slate-400 truncate">
                    {[c.website || c.domain, c.industry, c.employee_range, c.location].filter(Boolean).join(" · ")}
                  </span>
                  {c.why_fits ? <span className="mt-0.5 block text-xs text-slate-500">{c.why_fits}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {(addedIds.length > 0 || showResearch) && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Same research as your seed list</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowResearch((open) => !open)}
              className="rounded-full text-emerald-800"
            >
              {showResearch ? "Hide research prompt" : "Open research prompt"}
            </Button>
          </div>
          {showResearch && (
            <ResearchPromptPanel
              listId={listId}
              prospects={researchProspects.length ? researchProspects : prospects}
              onChanged={() => onChanged?.(listId)}
            />
          )}
        </div>
      )}
    </div>
  );
}
