import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Loader2 } from "lucide-react";

const EVIDENCE_TONE = {
  published: "bg-sky-50 text-sky-700 border-sky-200",
  customer_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unverified: "bg-amber-50 text-amber-700 border-amber-200",
};

const EVIDENCE_LABEL = {
  published: "Published",
  customer_confirmed: "Customer confirmed",
  unverified: "No source",
};

// One account's research, opened from the compact research list.
export default function AccountResearchDetail({ record, onClose, onRecordUpdated }) {
  const [busyIndex, setBusyIndex] = useState(null);
  const findings = record?.findings || [];

  const toggleEvidence = async (index) => {
    const finding = findings[index];
    const next = finding.evidence === "customer_confirmed" ? "published" : "customer_confirmed";
    setBusyIndex(index);
    try {
      const updated = findings.map((item, i) => (i === index ? { ...item, evidence: next } : item));
      await base44.entities.AccountResearch.update(record.id, { findings: updated });
      onRecordUpdated?.({ ...record, findings: updated });
    } finally {
      setBusyIndex(null);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="text-left pr-6">
          <DialogTitle className="font-display text-lg font-semibold text-slate-900">
            {record?.company_name}
          </DialogTitle>
          <p className="text-xs text-slate-400">
            {record?.researched_at ? new Date(record.researched_at).toLocaleDateString("en-GB") : "Not dated"} ·{" "}
            {findings.length} finding{findings.length === 1 ? "" : "s"} · {record?.source_count || 0} source
            {(record?.source_count || 0) === 1 ? "" : "s"}
          </p>
        </DialogHeader>

        {record?.summary && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">{record.summary}</p>
        )}

        {findings.length ? (
          <ul className="divide-y divide-slate-100">
            {findings.map((finding, index) => {
              const evidence = finding.evidence || "published";
              return (
                <li key={index} className="py-2.5 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-slate-400">{finding.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleEvidence(index)}
                      disabled={busyIndex === index}
                      title="Toggle between published research and customer-confirmed"
                      className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] transition-colors ${EVIDENCE_TONE[evidence]}`}
                    >
                      {busyIndex === index ? <Loader2 className="w-3 h-3 animate-spin" /> : EVIDENCE_LABEL[evidence]}
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
          <p className="text-sm text-slate-400">No published findings for this instruction.</p>
        )}

        {record?.target_roles?.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-400">Roles worth calling</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {record.target_roles.map((role) => (
                <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{role}</span>
              ))}
            </div>
          </div>
        )}

        {record?.prompt && (
          <p className="border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
            Instruction: {record.prompt}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}