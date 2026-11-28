import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ExternalLink, BrainCircuit } from "lucide-react";
import { normalisedCompanyName } from "@/lib/researchMatching";

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

// Research for the company being called, shown beside the briefing. Reads the
// campaign's research records and matches on the exact company name only.
export default function CallResearchPanel({ campaignId, company }) {
  const [record, setRecord] = useState(null);

  useEffect(() => {
    let alive = true;
    setRecord(null);
    if (!campaignId || !company?.name) return undefined;
    (async () => {
      const lists = await base44.entities.ProspectList
        .filter({ campaign_id: campaignId }, "-created_date", 1)
        .catch(() => []);
      const list = lists?.[0];
      if (!list) return;
      const rows = await base44.entities.AccountResearch
        .filter({ prospect_list_id: list.id }, "-researched_at", 100)
        .catch(() => []);
      const wanted = normalisedCompanyName(company.name);
      const match = (rows || []).find((row) => normalisedCompanyName(row.company_name) === wanted);
      if (alive) setRecord(match || null);
    })();
    return () => {
      alive = false;
    };
  }, [campaignId, company?.name]);

  if (!record) return null;

  const findings = (record.findings || []).slice(0, 6);

  return (
    <div className="rounded-3xl border border-emerald-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-emerald-700">
          <BrainCircuit className="w-3.5 h-3.5" /> Campaign research
        </p>
        <span className="text-[11px] text-slate-400">
          {record.researched_at ? new Date(record.researched_at).toLocaleDateString("en-GB") : ""}
        </span>
      </div>

      {record.summary && <p className="text-sm leading-relaxed text-slate-700">{record.summary}</p>}

      <ul className="space-y-2">
        {findings.map((finding, index) => {
          const evidence = finding.evidence || "published";
          return (
            <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-400">{finding.label}</span>
                <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] ${EVIDENCE_TONE[evidence]}`}>
                  {EVIDENCE_LABEL[evidence]}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{finding.value}</p>
              {(finding.source_url || finding.source_date) && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
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
              )}
            </li>
          );
        })}
      </ul>

      {record.target_roles?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {record.target_roles.map((role) => (
            <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {role}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}