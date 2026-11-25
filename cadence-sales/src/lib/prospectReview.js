import { base44 } from "@/api/base44Client";

// Fetches company-centric review rows for a Target List, joining fit scores,
// company intelligence, decision-makers and best available number.
export async function fetchReviewRows(targetListId) {
  const [members, fits, intelAll, contactsAll, attempts] = await Promise.all([
    base44.entities.TargetListMember.filter({ target_list_id: targetListId }, "-created_date", 500),
    base44.entities.TargetListCompanyFit.filter({ target_list_id: targetListId }, "-scored_at", 500),
    base44.entities.CompanyIntelligence.list("-researched_at", 500),
    base44.entities.Contact.list("-updated_date", 500),
    base44.entities.EnrichmentAttempt.filter({ target_list_id: targetListId }, "-attempted_at", 200).catch(() => []),
  ]);
  const companyIds = new Set(members.map((m) => m.company_id).filter(Boolean));
  const fitByCompany = new Map(fits.map((f) => [f.company_id, f]));
  const intelByCompany = new Map(intelAll.map((i) => [i.company_id, i]));

  const companies = await Promise.all([...companyIds].map((id) => base44.entities.Company.get(id).catch(() => null)));
  const failedByCompany = new Map();
  for (const a of (attempts || [])) {
    if ((a.status === "failed" || a.status === "not_found") && a.company_id) {
      failedByCompany.set(a.company_id, (failedByCompany.get(a.company_id) || 0) + 1);
    }
  }

  return companies.filter(Boolean).map((co) => {
    const fit = fitByCompany.get(co.id);
    const intel = intelByCompany.get(co.id);
    const dms = contactsAll.filter((c) => c.company_id === co.id);
    const dialable = dms.find((c) => c.phone && !["bad", "dnc"].includes(c.number_status));
    const firstWithPhone = dms.find((c) => c.phone);
    const needsEnrich = dms.filter((c) => !c.phone).length;
    return {
      company: co,
      fit, intel,
      dmCount: dms.length,
      bestNumber: dialable?.phone || firstWithPhone?.phone || "",
      bestNumberType: dialable ? "direct" : (dms.find((c) => c.phone) ? "other" : ""),
      source: intel?.source || (dms[0]?.source) || "",
      confidence: intel?.confidence || 0,
      estEnrichCost: needsEnrich,
      enrichmentFailed: (failedByCompany.get(co.id) || 0) > 0 && !dialable,
      researchStatus: intel?.status || "pending",
    };
  });
}

// Derive a single review filter bucket for a row.
export function reviewBucket(row) {
  const { fit, researchStatus, dmCount, bestNumber, enrichmentFailed } = row;
  if (fit?.review_status === "approved" && bestNumber) return "call_ready";
  if (fit?.review_status === "approved") return "approved";
  if (fit?.review_status === "rejected") return "rejected";
  if (fit?.review_status === "needs_review") return "needs_review";
  if (researchStatus === "researching") return "researching";
  if (enrichmentFailed) return "enrichment_failed";
  if (!fit || researchStatus === "pending" || researchStatus === "failed") return "pending_research";
  if (fit?.fit_band === "high") return "high";
  if (fit?.fit_band === "medium") return "medium";
  if (fit?.fit_band === "low") return "low";
  return "pending_research";
}

export const REVIEW_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending_research", label: "Pending research" },
  { id: "researching", label: "Researching" },
  { id: "high", label: "High fit" },
  { id: "medium", label: "Medium fit" },
  { id: "low", label: "Low fit" },
  { id: "needs_review", label: "Needs review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "enrichment_failed", label: "Enrichment failed" },
  { id: "call_ready", label: "Call ready" },
];

export const FIT_BAND_STYLE = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
  excluded: "bg-rose-50 text-rose-700 border-rose-200",
};

export const RESEARCH_STATUS_LABEL = {
  pending: "Pending", researching: "Researching", current: "Current",
  stale: "Stale", failed: "Failed",
};

export function freshnessLabel(intel) {
  if (!intel) return { label: "Not researched", tone: "muted" };
  if (intel.status === "failed") return { label: "Failed", tone: "bad" };
  if (intel.status === "researching") return { label: "Researching", tone: "warn" };
  if (!intel.expires_at) return { label: "Current", tone: "ok" };
  const exp = new Date(intel.expires_at).getTime();
  const now = Date.now();
  const week = 7 * 86400000;
  if (exp < now) return { label: "Expired", tone: "bad" };
  if (exp < now + week) return { label: "Expiring soon", tone: "warn" };
  return { label: "Current", tone: "ok" };
}