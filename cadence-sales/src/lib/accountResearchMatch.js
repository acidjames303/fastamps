// Match Prospecting AccountResearch rows to a Dialer Company without a schema
// change. Canonical key prefers normalised name (Ltd/Limited stripped).

export function normaliseCompanyName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|plc|llp|incorporated|inc|company|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

/** Best AccountResearch record for a company, or null. */
export function matchAccountResearch(rows, company) {
  const target = normaliseCompanyName(company?.name || company?.company_name || "");
  if (!target || !Array.isArray(rows) || !rows.length) return null;

  const matches = rows.filter(
    (r) => normaliseCompanyName(r.company_name || "") === target,
  );
  if (!matches.length) return null;

  const scored = matches.slice().sort((a, b) => {
    const aScore = (Array.isArray(a.findings) && a.findings.length ? 2 : 0) + (a.summary ? 1 : 0);
    const bScore = (Array.isArray(b.findings) && b.findings.length ? 2 : 0) + (b.summary ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return new Date(b.researched_at || 0).getTime() - new Date(a.researched_at || 0).getTime();
  });
  return scored[0] || null;
}

/** Prospect has a dialable number that still needs human confirmation for call-ready. */
export function needsCallReadyConfirm(prospect) {
  if (!prospect) return false;
  const status = prospect.phone_status || "";
  if (["verified", "manually_confirmed"].includes(status)) return false;
  if (["invalid", "employment_mismatch"].includes(status)) return false;

  const people = Array.isArray(prospect.contacts) ? prospect.contacts : [];
  const peopleNumber = people.some((c) => !!(c.mobile || c.phone));
  const phone = prospect.phone || prospect.mobile || "";
  if (!phone && !peopleNumber) return false;
  // Switchboard-only records are not call-ready unless a person mobile exists.
  if (prospect.phone_type === "switchboard" && !prospect.mobile && !people.some((c) => !!c.mobile)) {
    return false;
  }
  return true;
}
