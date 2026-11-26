import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Send, ShieldCheck, X } from "lucide-react";
import { brandChoices } from "@/lib/outreachBrands";

const COUNT_LABELS = [
  { key: "eligible", label: "Ready to push" },
  { key: "already_in_outreach", label: "Already in outreach" },
  { key: "no_email", label: "No usable email" },
  { key: "suppressed", label: "Suppressed" },
  { key: "flagged_company", label: "Company to check" },
  { key: "with_research", label: "With sourced research" },
];

// Moves prospect contacts into an outreach campaign. Nothing is drafted or sent
// here: the contacts land in the campaign's review queue with their research,
// phones and company identity preserved.
export default function PushToOutreachDialog({ open, onClose, prospectIds = [], listId, listName, onPushed }) {
  const [campaigns, setCampaigns] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [brandKey, setBrandKey] = useState("fastamps");
  const [scope, setScope] = useState("selected");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const brands = useMemo(() => brandChoices(workspaces), [workspaces]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError("");
    setPreview(null);
    setScope(prospectIds.length ? "selected" : "all");
    (async () => {
      const [campaignRows, workspaceRows] = await Promise.all([
        base44.entities.Campaign.list("-created_date", 100).catch(() => []),
        base44.entities.OutreachWorkspace.list("-created_at", 50).catch(() => []),
      ]);
      setCampaigns(campaignRows || []);
      setWorkspaces(workspaceRows || []);
    })();
  }, [open, prospectIds.length]);

  const loadPreview = useCallback(async () => {
    if (!open || !campaignId) return;
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("pushProspectsToOutreach", {
        action: "preview",
        brand_key: brandKey,
        campaign_id: campaignId,
        scope,
        prospect_ids: scope === "selected" ? prospectIds : [],
        prospect_list_id: listId,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setPreview(data);
    } catch (e) {
      setPreview(null);
      setError(e?.response?.data?.error || e.message || "Could not preview this push.");
    } finally {
      setLoading(false);
    }
  }, [open, campaignId, brandKey, scope, prospectIds, listId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const push = async () => {
    if (!campaignId || pushing) return;
    setPushing(true);
    setError("");
    try {
      const res = await base44.functions.invoke("pushProspectsToOutreach", {
        action: "push",
        brand_key: brandKey,
        campaign_id: campaignId,
        scope,
        prospect_ids: scope === "selected" ? prospectIds : [],
        prospect_list_id: listId,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setPreview(data);
      await onPushed?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not push these contacts.");
    } finally {
      setPushing(false);
    }
  };

  if (!open) return null;

  const counts = preview?.counts || null;
  const eligible = counts?.eligible || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">Push to Outreach</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sends reviewed prospect contacts into a campaign's review queue. Phones, emails, company identity and
              sourced research travel with them. No CSV and no emails sent.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Outreach campaign
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">Choose a campaign…</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name || "Untitled campaign"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Brand
            <select
              value={brandKey}
              onChange={(e) => setBrandKey(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {brands.map((brand) => (
                <option key={brand.key} value={brand.key}>
                  {brand.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-slate-400">Contacts</span>
          <button
            type="button"
            aria-pressed={scope === "selected"}
            onClick={() => setScope("selected")}
            disabled={!prospectIds.length}
            className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
              scope === "selected"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            Selected ({prospectIds.length})
          </button>
          <button
            type="button"
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              scope === "all"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            All eligible{listName ? ` in ${listName}` : ""}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {!campaignId ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Choose the campaign these contacts should join.
          </p>
        ) : loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking what can be pushed…
          </p>
        ) : counts ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COUNT_LABELS.map((item) => (
                <div key={item.key} className="rounded-xl border border-slate-200 px-3 py-2">
                  <p className="font-display text-lg font-semibold text-slate-900">{counts[item.key] || 0}</p>
                  <p className="text-[11px] text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>

            {!!preview?.skipped?.length && (
              <ul className="max-h-32 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500 space-y-1">
                {preview.skipped.slice(0, 12).map((row, index) => (
                  <li key={`${row.email || row.prospect_id}-${index}`}>
                    {row.company_name || row.email || "Contact"} — {String(row.reason).replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            )}

            {!!preview?.sample?.length && (
              <div className="rounded-xl border border-slate-200">
                <p className="px-3 pt-2 text-[11px] uppercase tracking-widest text-slate-400">Preview</p>
                <ul className="divide-y divide-slate-100">
                  {preview.sample.map((row) => (
                    <li key={row.email} className="px-3 py-2 text-xs">
                      <p className="font-medium text-slate-800">
                        {row.full_name || "Name to confirm"} · {row.company_name}
                      </p>
                      <p className="text-slate-500">{row.email}{row.job_title ? ` · ${row.job_title}` : ""}</p>
                      {!!row.research_fact && (
                        <p className="text-slate-400 mt-0.5 line-clamp-2">{row.research_fact}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {result && (
          <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {result.created} contact{result.created === 1 ? "" : "s"} pushed for review. Nothing was drafted or sent.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5" /> Suppressed contacts and duplicates are always skipped.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="rounded-full text-slate-500" onClick={onClose}>
              {result ? "Done" : "Cancel"}
            </Button>
            <Button
              onClick={push}
              disabled={!campaignId || !eligible || pushing}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
            >
              {pushing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {pushing ? "Pushing…" : `Push ${eligible || ""} contact${eligible === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}