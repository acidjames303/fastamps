import { base44 } from "@/api/base44Client";
import { isConversation, isConnectedCall } from "@/lib/outcomeRules";
import { getActiveCampaign } from "@/lib/campaignContext";

// Outcome categories for Target List metrics — match CallLog.outcome values.
// "Answered calls" = reached a human (incl. wrong person / PA screened / not suitable).
// "Conversations" = a meaningful two-way conversation (excludes misroutes).
export const SPOKE = new Set([
  "connected", "interested", "not_interested", "callback", "lead", "send_info",
  "future_potential", "identify_new_contact", "wrong_person", "duplicate",
  "not_suitable", "no_sales_calls", "pa_screened", "customer_service_number",
]);
export const CONVERSATION = new Set([
  "connected", "interested", "not_interested", "callback", "lead", "send_info",
  "future_potential", "identify_new_contact",
]);
export const INTERESTED = new Set(["lead", "future_potential", "interested"]);
export const OPPORTUNITY = new Set(["lead"]);

export async function fetchTargetLists() {
  return base44.entities.Campaign.list("-created_date", 100);
}

// Assign companies (by id) to a target list via organisation-scoped join records.
// Idempotent: skips companies already linked. Never duplicates underlying
// Company/Contact records — one company can sit in many lists through separate
// membership rows. All IDs are RLS-scoped to the caller's organisation.
export async function assignCompaniesToList(targetListId, companyIds, orgId, userId) {
  const ids = [...new Set((companyIds || []).filter(Boolean))];
  if (!ids.length) return { added: 0 };
  const existing = await base44.entities.TargetListMember.filter(
    { target_list_id: targetListId }, "-created_date", 500
  );
  const have = new Set(existing.map((m) => m.company_id));
  const toCreate = ids
    .filter((id) => !have.has(id))
    .map((company_id) => ({
      target_list_id: targetListId,
      company_id,
      organisation_id: orgId,
      owner_user_id: userId,
    }));
  if (toCreate.length) await base44.entities.TargetListMember.bulkCreate(toCreate);
  return { added: toCreate.length };
}

// The list a caller is actually working.
// Prefer sticky campaign context (Phase 1) when that campaign still has members;
// otherwise fall back to the newest non-archived list that holds companies.
export async function resolveWorkingListId() {
  const stickyId = getActiveCampaign()?.id || "";

  if (stickyId) {
    const sticky = await base44.entities.Campaign.get(stickyId).catch(() => null);
    if (sticky && sticky.status !== "archived") {
      const count = await base44.entities.TargetListMember.count({ target_list_id: sticky.id }).catch(() => 0);
      if (count > 0) return sticky.id;
    }
  }

  const lists = await base44.entities.Campaign.list("-created_date", 10);
  for (const list of lists) {
    if (list.status === "archived") continue;
    const count = await base44.entities.TargetListMember.count({ target_list_id: list.id }).catch(() => 0);
    if (count > 0) return list.id;
  }
  return "";
}

// Company ids linked to a target list.
export async function fetchListCompanyIds(targetListId) {
  const members = await base44.entities.TargetListMember.filter(
    { target_list_id: targetListId }, "-created_date", 500
  );
  return [...new Set(members.map((m) => m.company_id).filter(Boolean))];
}

// Metrics for a target list, derived from members + that list's CallLogs.
// Contacts are resolved client-side from the org's contact list (RLS-scoped).
export async function computeListMetrics(targetListId) {
  const [members, logs, allContacts] = await Promise.all([
    base44.entities.TargetListMember.filter({ target_list_id: targetListId }, "-created_date", 500),
    base44.entities.CallLog.filter({ campaign_id: targetListId }, "-created_date", 500),
    base44.entities.Contact.list("-updated_date", 500),
  ]);
  const companyIds = new Set(members.map((m) => m.company_id).filter(Boolean));
  const memberContactIds = new Set(
    members.map((m) => m.contact_id).filter(Boolean)
  );
  const listContacts = allContacts.filter(
    (c) => (c.company_id && companyIds.has(c.company_id)) || memberContactIds.has(c.id)
  );
  return {
    companies: companyIds.size,
    contacts: listContacts.length,
    callReady: listContacts.filter((c) => !["bad", "dnc"].includes(c.number_status)).length,
    callsAttempted: logs.length,
    answeredCalls: logs.filter(isConnectedCall).length,
    conversations: logs.filter(isConversation).length,
    interested: logs.filter((l) => INTERESTED.has(l.outcome)).length,
    opportunities: logs.filter((l) => OPPORTUNITY.has(l.outcome)).length,
    badNumbers: listContacts.filter((c) => c.number_status === "bad").length,
  };
}