// Client-safe lead summary from an Opportunity (+ optional contact/company).
// Never includes internal notes, coaching, or confidential management fields.

function line(label, value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return `${label}: ${text}`;
}

/**
 * Prefill a pasteable lead sheet from records Cadence already holds.
 * Callers / BDMs only fill what is still missing on the opportunity itself.
 */
export function buildLeadSheetSummary({ opportunity, contact = null, company = null, campaign = null } = {}) {
  const opp = opportunity || {};
  const companyName = company?.name || opp.company_name || "";
  const contactName = contact?.full_name || opp.contact_name || "";
  const blocks = [
    "Cadence lead summary",
    "—",
    line("Client / campaign", campaign?.client_name || campaign?.name || opp.client_name),
    line("Company", companyName),
    line("Website", company?.website || company?.domain),
    line("Industry", company?.industry),
    line("Location", company?.location),
    line("Contact", contactName),
    line("Job title", contact?.job_title),
    line("Email", contact?.email),
    line("Phone", contact?.phone || contact?.mobile),
    "",
    line("Need", opp.need_summary || opp.need),
    line("Pain", opp.pain_points || opp.pain),
    line("Current solution", opp.current_solution),
    line("Timing", opp.timing),
    line("Budget", opp.budget),
    line("Decision maker", opp.decision_maker || opp.authority_status),
    line("Decision process", opp.decision_process),
    line("Agreed next step", opp.next_step || opp.agreed_next_step),
    line("Estimated value", opp.estimated_value ? `£${opp.estimated_value}` : ""),
    line("Qualification", opp.qualification_status),
    "",
    "Confidential management comments are omitted from this summary.",
  ];
  return blocks.filter((row) => row !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
