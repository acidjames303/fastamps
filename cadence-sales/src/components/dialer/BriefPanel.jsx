import React from "react";
import {
  Building2, MapPin, Users, Loader2, Target, Briefcase,
  ExternalLink, TrendingUp, Cpu, Newspaper, Zap, Gauge, Clock, UserPlus, Search,
} from "lucide-react";
import DecisionMakerList from "@/components/dialer/DecisionMakerList";

const EVIDENCE_TONE = {
  published: "bg-sky-50 text-sky-700 border-sky-200",
  customer_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unverified: "bg-amber-50 text-amber-700 border-amber-200",
};

const EVIDENCE_LABEL = {
  published: "Published",
  customer_confirmed: "Confirmed",
  unverified: "Unverified",
};

function parseBrief(text) {
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    if (obj && (obj.summary || obj.what_they_do || obj.who_they_target)) return obj;
  } catch {}
  return null;
}

function companyUrl(website, company) {
  if (website) {
    const u = website.trim();
    return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`;
  }
  if (company) return `https://www.google.com/search?q=${encodeURIComponent(company)}`;
  return null;
}

const splitLine = (line) => {
  const idx = line.indexOf("—");
  if (idx === -1) return { heading: line, detail: "" };
  return { heading: line.slice(0, idx).trim(), detail: line.slice(idx + 1).trim() };
};

// Company-first briefing panel. CompanyIntelligence is the reusable cache;
// AccountResearch from Prospecting is shown live so dig-deeper findings and
// source URLs stay available on the call. Research is never generated here.
export default function BriefPanel({
  company,
  intelligence,
  accountResearch = null,
  contacts,
  selectedContact,
  onSelectContact,
  onAddContact,
  onEditContact,
  loading,
}) {
  if (!company) return null;

  const brief = parseBrief(intelligence?.ai_summary || (selectedContact?.ai_brief));
  const coName = company.name;
  const coWebsite = company.website;
  const fit = typeof intelligence?.icp_fit_score === "number" ? intelligence.icp_fit_score : null;
  const findings = Array.isArray(accountResearch?.findings)
    ? accountResearch.findings.filter((f) => f?.label && f?.value)
    : [];
  const researchSummary = (accountResearch?.summary || "").trim();
  const hasProspectingResearch = !!(researchSummary || findings.length);

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-7 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-400">Company</p>
        <div className="flex items-start justify-between gap-3 mt-1">
          {coWebsite ? (
            <a href={companyUrl(coWebsite, coName)} target="_blank" rel="noopener noreferrer" className="font-display text-2xl font-semibold text-slate-900 hover:underline inline-flex items-center gap-1.5">
              {coName}
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>
          ) : (
            <h2 className="font-display text-2xl font-semibold text-slate-900">{coName}</h2>
          )}
          {fit !== null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 shrink-0">
              <Gauge className="w-3 h-3" /> ICP fit {fit}
            </span>
          )}
        </div>
        {selectedContact && (
          <p className="text-slate-500 mt-1">
            Speaking with <span className="font-medium text-slate-700">{selectedContact.full_name}</span>
            {selectedContact.job_title ? ` · ${selectedContact.job_title}` : ""}
          </p>
        )}
      </div>

      <div className="grid gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          {company.industry || "Industry n/a"}
          <span className="text-slate-300">·</span>
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {company.employee_range || "size n/a"}
        </div>
        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400 shrink-0" />{company.location || "Location n/a"}</div>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-600">
            <Building2 className="w-3.5 h-3.5" /> Company overview
          </div>
          {intelligence?.generated_at && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <Clock className="w-3 h-3" /> {new Date(intelligence.generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading company research…
          </div>
        ) : brief ? (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-slate-700">{brief.summary}</p>

            {brief.what_they_do?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-2">
                  <Briefcase className="w-3.5 h-3.5" /> What they do
                </div>
                <ul className="space-y-2">
                  {brief.what_they_do.map((line, i) => {
                    const { heading, detail } = splitLine(line);
                    return (
                      <li key={i} className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{heading}</span>
                        {detail && <span className="text-slate-600"> — {detail}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {brief.who_they_target?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-2">
                  <Target className="w-3.5 h-3.5" /> Who they target
                </div>
                <ul className="space-y-2">
                  {brief.who_they_target.map((line, i) => {
                    const { heading, detail } = splitLine(line);
                    return (
                      <li key={i} className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{heading}</span>
                        {detail && <span className="text-slate-600"> — {detail}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}


            {(intelligence?.turnover_estimate || intelligence?.tech_stack?.length || intelligence?.news || intelligence?.buyer_signals) && (
              <div className="pt-4 border-t border-slate-200 space-y-2">
                {intelligence.turnover_estimate && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Est. turnover: {intelligence.turnover_estimate}
                  </div>
                )}
                {intelligence.tech_stack?.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <Cpu className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                    <div className="flex flex-wrap gap-1.5">{intelligence.tech_stack.map((t, i) => <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{t}</span>)}</div>
                  </div>
                )}
                {intelligence.news && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <Newspaper className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" /> {intelligence.news}
                  </div>
                )}
                {intelligence.buyer_signals && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" /> {intelligence.buyer_signals}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : selectedContact?.ai_brief ? (
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{selectedContact.ai_brief}</p>
        ) : (
          <p className="text-sm text-slate-400">No company research yet — you can still dial.</p>
        )}
      </div>

      {hasProspectingResearch && (
        <div className="rounded-2xl bg-emerald-50/40 border border-emerald-100 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-700">
              <Search className="w-3.5 h-3.5" /> Prospecting research
            </div>
            {accountResearch?.researched_at && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" /> {new Date(accountResearch.researched_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {researchSummary ? (
            <p className="text-sm leading-relaxed text-slate-700">{researchSummary}</p>
          ) : null}
          {findings.length > 0 && (
            <ul className="space-y-2.5">
              {findings.map((f, i) => (
                <li key={`${f.label}-${i}`} className="text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{f.label}</span>
                    {f.evidence && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${EVIDENCE_TONE[f.evidence] || EVIDENCE_TONE.unverified}`}>
                        {EVIDENCE_LABEL[f.evidence] || f.evidence}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mt-0.5">{f.value}</p>
                  {f.source_url ? (
                    <a
                      href={f.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline mt-0.5"
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {Array.isArray(accountResearch?.target_roles) && accountResearch.target_roles.length > 0 && (
            <p className="text-xs text-slate-500">
              Suggested roles: {accountResearch.target_roles.filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-widest text-slate-400">Decision-makers</p>
          {onAddContact && (
            <button
              type="button"
              onClick={onAddContact}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add contact
            </button>
          )}
        </div>
        <DecisionMakerList
          contacts={contacts}
          selectedId={selectedContact?.id}
          onSelect={onSelectContact}
          onEdit={onEditContact}
        />
      </div>
    </div>
  );
}