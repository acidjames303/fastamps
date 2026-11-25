import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react";

const EVIDENCE_TONE = {
  published: "bg-sky-50 text-sky-700 border-sky-200",
  customer_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unverified: "bg-amber-50 text-amber-700 border-amber-200",
};

const EVIDENCE_LABEL = {
  published: "Published",
  customer_confirmed: "Your research",
  unverified: "No source",
};

const DEFAULT_PROMPT =
  "For each account, record the source link, supplier, contract scope and dates. Keep published findings separate from anything confirmed by the customer.";

function promptHash(input) {
  let hash = 0;
  const text = String(input || "").trim().toLowerCase();
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return `${hash.toString(36)}-${text.length}`;
}

// One account's research pack: read findings, add your own, dig deeper with AI.
export default function AccountResearchDetail({
  record,
  prospect = null,
  listId = "",
  onClose,
  onRecordUpdated,
}) {
  const [local, setLocal] = useState(record || null);
  const [busyIndex, setBusyIndex] = useState(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [focus, setFocus] = useState("");
  const [digging, setDigging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocal(record || null);
    setError("");
    setAdding(false);
  }, [record?.id, prospect?.id]);

  const findings = local?.findings || [];
  const open = !!(local || prospect);

  const pushUpdate = (next) => {
    setLocal(next);
    onRecordUpdated?.(next);
  };

  const ensureRecord = async () => {
    if (local?.id) return local;
    if (!prospect?.id || !listId) throw new Error("Open research from a prospecting list first.");
    const user = await base44.auth.me();
    const prompt = DEFAULT_PROMPT;
    const created = await base44.entities.AccountResearch.create({
      organisation_id: user.organisation_id,
      prospect_list_id: listId,
      prospect_id: prospect.id,
      company_name: prospect.company_name,
      prompt,
      prompt_hash: promptHash(prompt),
      summary: "",
      findings: [],
      target_roles: [],
      source_count: 0,
      status: "complete",
      created_by_user_id: user.id,
      researched_at: new Date().toISOString(),
    });
    pushUpdate(created);
    return created;
  };

  const toggleEvidence = async (index) => {
    const finding = findings[index];
    const nextEvidence = finding.evidence === "customer_confirmed" ? "published" : "customer_confirmed";
    setBusyIndex(index);
    setError("");
    try {
      const updated = findings.map((item, i) => (i === index ? { ...item, evidence: nextEvidence } : item));
      await base44.entities.AccountResearch.update(local.id, { findings: updated });
      pushUpdate({ ...local, findings: updated });
    } catch (e) {
      setError(e.message || "Could not update evidence.");
    } finally {
      setBusyIndex(null);
    }
  };

  const removeFinding = async (index) => {
    if (!local?.id) return;
    setBusyIndex(index);
    setError("");
    try {
      const updated = findings.filter((_, i) => i !== index);
      const source_count = new Set(updated.map((f) => f.source_url).filter(Boolean)).size;
      await base44.entities.AccountResearch.update(local.id, { findings: updated, source_count });
      pushUpdate({ ...local, findings: updated, source_count });
    } catch (e) {
      setError(e.message || "Could not remove finding.");
    } finally {
      setBusyIndex(null);
    }
  };

  const addFinding = async () => {
    const cleanLabel = label.trim();
    const cleanValue = value.trim();
    if (!cleanLabel || !cleanValue || saving) return;
    setSaving(true);
    setError("");
    try {
      const base = await ensureRecord();
      const url = /^https?:\/\//i.test(sourceUrl.trim()) ? sourceUrl.trim() : "";
      const finding = {
        label: cleanLabel.slice(0, 80),
        value: cleanValue.slice(0, 900),
        source_url: url,
        source_date: "",
        evidence: "customer_confirmed",
        confidence: 100,
      };
      const updated = [...(base.findings || []), finding];
      const source_count = new Set(updated.map((f) => f.source_url).filter(Boolean)).size;
      const saved = await base44.entities.AccountResearch.update(base.id, {
        findings: updated,
        source_count,
        researched_at: new Date().toISOString(),
      });
      pushUpdate({ ...base, ...saved, findings: updated, source_count });
      setLabel("");
      setValue("");
      setSourceUrl("");
      setAdding(false);
    } catch (e) {
      setError(e.message || "Could not save your research.");
    } finally {
      setSaving(false);
    }
  };

  const digDeeper = async () => {
    if (!listId || digging) return;
    setDigging(true);
    setError("");
    try {
      const base = await ensureRecord();
      const prompt = (base.prompt || DEFAULT_PROMPT).trim();
      const res = await base44.functions.invoke("researchAccountsPrompted", {
        prospect_list_id: listId,
        prospect_ids: [base.prospect_id],
        prompt,
        mode: "deeper",
        focus: focus.trim(),
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      const failed = data?.results?.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error);
      const refreshed = await base44.entities.AccountResearch.get(base.id).catch(() => null);
      if (refreshed) pushUpdate(refreshed);
      else {
        const rows = await base44.entities.AccountResearch
          .filter({ prospect_id: base.prospect_id, prospect_list_id: listId }, "-researched_at", 1)
          .catch(() => []);
        if (rows?.[0]) pushUpdate(rows[0]);
      }
      setFocus("");
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Dig deeper stopped. Try again in a moment.");
    } finally {
      setDigging(false);
    }
  };

  const title = local?.company_name || prospect?.company_name || "Account research";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="text-left pr-6">
          <DialogTitle className="font-display text-lg font-semibold text-slate-900">
            {title}
          </DialogTitle>
          <p className="text-xs text-slate-400">
            {local?.researched_at ? new Date(local.researched_at).toLocaleDateString("en-GB") : "Not researched yet"} ·{" "}
            {findings.length} finding{findings.length === 1 ? "" : "s"} · {local?.source_count || 0} source
            {(local?.source_count || 0) === 1 ? "" : "s"}
          </p>
        </DialogHeader>

        {local?.summary && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
            {local.summary}
          </p>
        )}

        {findings.length ? (
          <ul className="divide-y divide-slate-100">
            {findings.map((finding, index) => {
              const evidence = finding.evidence || "published";
              return (
                <li key={`${finding.label}-${index}`} className="py-2.5 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-slate-400">{finding.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleEvidence(index)}
                      disabled={busyIndex === index || !local?.id}
                      title="Toggle between published research and your confirmed research"
                      className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] transition-colors ${EVIDENCE_TONE[evidence]}`}
                    >
                      {busyIndex === index ? <Loader2 className="w-3 h-3 animate-spin" /> : EVIDENCE_LABEL[evidence]}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFinding(index)}
                      disabled={busyIndex === index || !local?.id}
                      className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                      title="Remove finding"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{finding.value}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    {finding.source_url && (
                      <a
                        href={finding.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800"
                      >
                        Source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {finding.source_date && <span>{finding.source_date}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            No findings yet — add what you already know, or ask Cadence to dig deeper.
          </p>
        )}

        {local?.target_roles?.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-400">Roles worth calling</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {local.target_roles.map((role) => (
                <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{role}</span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-slate-300"
              onClick={() => setAdding((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {adding ? "Cancel" : "Add your research"}
            </Button>
          </div>

          {adding && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label — e.g. Incumbent supplier"
                className="rounded-lg bg-white text-sm"
              />
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="What you know — contract detail, contact, tip from a call…"
                rows={3}
                className="rounded-lg bg-white text-sm"
              />
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Source URL (optional)"
                className="rounded-lg bg-white text-sm"
              />
              <Button
                type="button"
                onClick={addFinding}
                disabled={saving || !label.trim() || !value.trim()}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Save to this account
              </Button>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="text-sm font-medium text-slate-900">Dig deeper</p>
            <p className="text-xs text-slate-500">
              Cadence searches further from public sources and merges new findings into this pack — your notes stay.
            </p>
            <Textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional focus — e.g. find the telecare contract value and end date"
              rows={2}
              disabled={digging}
              className="rounded-lg bg-white text-sm"
            />
            <Button
              type="button"
              onClick={digDeeper}
              disabled={digging || !listId}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
            >
              {digging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {digging ? "Searching further…" : "Search further"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}

        {local?.prompt && (
          <p className="border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
            Instruction: {local.prompt}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
