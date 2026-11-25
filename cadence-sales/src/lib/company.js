import { base44 } from "@/api/base44Client";

const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Company-name normalisation for matching: drops common legal suffixes so
// "Acme Ltd", "ACME Limited" and "Acme" all collapse to the same key.
const SUFFIX_RE = /\b(ltd|limited|plc|llp|llc|inc|incorporated|corp|corporation|co|group|holdings|uk|gb)\b\.?/g;

function normName(s) {
  return norm(s)
    .replace(/&/g, "and")
    .replace(SUFFIX_RE, " ")
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Domain normalisation: strips protocol, www, path, query, trailing slash.
function normDomain(d) {
  if (!d) return "";
  let v = norm(d);
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\?.*$/, "").trim();
  return v;
}

function domainOf(c) {
  return normDomain(c.domain || c.website || "");
}

// Find-or-create Company records for the given company inputs and return a
// lookup function: (name, website?) => company_id | undefined.
//
// Matching priority (never crosses organisations — RLS scopes the Company list
// to the caller's org, so matches are inherently same-org):
//   1. Exact normalised domain
//   2. Exact normalised company name (suffix-stripped)
//   3. Similar name + compatible location -> flagged for review, NOT auto-merged
//   4. Conflicting domains -> kept separate
// Returns a function with a `.stats` property: { created, reused, duplicates, review }.
export async function resolveCompanyIds(companyInputs) {
  const byName = new Map();
  const byDomain = new Map();
  const review = [];

  const stats = { created: 0, reused: 0, duplicates: 0, review };

  if (!companyInputs || !companyInputs.length) {
    const fn = () => undefined;
    fn.stats = stats;
    return fn;
  }

  const existing = await base44.entities.Company.list("-created_date", 1000);
  existing.forEach((c) => {
    const nn = normName(c.name);
    if (nn) byName.set(nn, c.id);
    const nd = domainOf(c);
    if (nd) byDomain.set(nd, c.id);
  });

  const toCreate = new Map();
  companyInputs.forEach((c) => {
    const nn = normName(c.name);
    const nd = domainOf(c);
    // 1. Exact domain match -> reuse, do not duplicate.
    if (nd && byDomain.has(nd)) { stats.reused++; return; }
    // 2. Exact normalised name match -> reuse.
    if (nn && byName.has(nn)) { stats.reused++; return; }
    // 3. Similar name (shared token) but different domain -> flag for review.
    if (nn) {
      const tokens = nn.split(" ").filter((t) => t.length > 3);
      const similar = [...byName.keys()].find((k) => tokens.some((t) => k.includes(t)));
      if (similar && nd && ![...byDomain.keys()].includes(nd)) {
        review.push({ name: c.name, similar_to: similar });
      }
    }
    if (nn && !toCreate.has(nn)) {
      toCreate.set(nn, {
        name: (c.name || "").trim(),
        domain: nd || undefined,
        website: c.website || "",
        industry: c.industry || "",
        location: c.location || "",
        employee_range: c.employee_range || "",
        linkedin: c.linkedin || "",
        owner_user_id: c.owner_user_id || "",
        organisation_id: c.organisation_id,
      });
    }
  });

  const pending = [...toCreate.values()];
  if (pending.length) {
    await base44.entities.Company.bulkCreate(pending);
    stats.created = pending.length;
    const refreshed = await base44.entities.Company.list("-created_date", 1000);
    refreshed.forEach((c) => {
      const nn = normName(c.name);
      if (nn) byName.set(nn, c.id);
      const nd = domainOf(c);
      if (nd) byDomain.set(nd, c.id);
    });
  }

  const fn = (name, website) => {
    const nd = normDomain(website || "");
    if (nd && byDomain.has(nd)) return byDomain.get(nd);
    return byName.get(normName(name));
  };
  fn.stats = stats;
  return fn;
}