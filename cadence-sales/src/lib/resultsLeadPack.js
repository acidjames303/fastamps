import { base44 } from "@/api/base44Client";
import { buildLeadSheetSummary } from "@/lib/leadSheetSummary";

const LEAD_STATUSES = new Set(["qualified", "qualifying"]);
const REVIEW_STATUSES = new Set(["awaiting_review", "approved", "changes_requested"]);

function inRange(raw, start, end) {
  if (!raw) return !start && !end;
  const d = new Date(raw);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

/**
 * Opportunities that belong with a Results download for the selected campaign
 * and date window — qualified / in review only. Never invents leads.
 */
export async function loadRelevantOpportunities({ campaignId = "", start = null, end = null, companyIds = [] } = {}) {
  const rows = await base44.entities.Opportunity.list("-updated_date", 200).catch(() => []);
  const companySet = new Set((companyIds || []).filter(Boolean));
  return (rows || []).filter((opp) => {
    if (campaignId && opp.campaign_id && opp.campaign_id !== campaignId) return false;
    const isLead =
      LEAD_STATUSES.has(opp.qualification_status)
      || REVIEW_STATUSES.has(opp.manager_review_status)
      || ["qualified", "meeting_proposed", "meeting_booked", "handoff_ready", "handed_off"].includes(opp.stage);
    if (!isLead) return false;
    const onCampaign = campaignId && opp.campaign_id === campaignId;
    const inCompanies = companySet.size ? companySet.has(opp.company_id) : true;
    if (!onCampaign && !inCompanies) return false;
    // Campaign-scoped leads always travel with that campaign's pack.
    if (onCampaign) return true;
    return inRange(opp.updated_date || opp.created_date, start, end);
  });
}

export async function buildLeadSummariesDocument(opportunities, { campaign = null } = {}) {
  const parts = [];
  for (const opp of opportunities || []) {
    const [contact, company] = await Promise.all([
      opp.primary_contact_id
        ? base44.entities.Contact.get(opp.primary_contact_id).catch(() => null)
        : null,
      opp.company_id
        ? base44.entities.Company.get(opp.company_id).catch(() => null)
        : null,
    ]);
    parts.push(buildLeadSheetSummary({ opportunity: opp, contact, company, campaign }));
  }
  if (!parts.length) {
    return "No qualified lead summaries in this selection.\nConfidential management notes are never included.";
  }
  return [
    "Cadence client lead summaries",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "Confidential management notes are omitted.",
    "",
    parts.join("\n\n==========\n\n"),
    "",
  ].join("\n");
}

export function triggerTextDownload(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
