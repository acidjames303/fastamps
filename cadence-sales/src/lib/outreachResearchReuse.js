/**
 * Build a short list of source-backed facts already held for an Outreach lead
 * (push from Prospecting / Dialer research). Prefer these over spending a
 * fresh suggestOutreachCompanyResearch credit.
 */
export function pickableFindings({ lead = null, researchRecord = null } = {}) {
  const out = [];
  const seen = new Set();

  const push = (rawFact, rawUrl, label) => {
    const fact = String(rawFact || "").trim().slice(0, 900);
    if (fact.length < 8) return;
    const key = fact.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      fact,
      source_url: String(rawUrl || "").trim().slice(0, 500),
      label: String(label || "Finding").trim().slice(0, 80) || "Finding",
    });
  };

  if (lead?.research_fact) {
    push(lead.research_fact, lead.research_source_url, "Saved for outreach");
  }

  for (const row of Array.isArray(lead?.research_facts) ? lead.research_facts : []) {
    push(row?.value || row?.fact, row?.source_url, row?.label || "Campaign finding");
  }

  if (researchRecord?.summary) {
    push(researchRecord.summary, "", "Campaign summary");
  }

  for (const finding of Array.isArray(researchRecord?.findings) ? researchRecord.findings : []) {
    push(finding?.value, finding?.source_url, finding?.label || "Campaign finding");
  }

  return out.slice(0, 8);
}

/** True when the reviewer already has reuseable research and should not need a paid suggest first. */
export function hasReusableResearch(findings = []) {
  return Array.isArray(findings) && findings.length > 0;
}
