// Manager “needs attention” signals for the Campaigns list — derived from
// progress already loaded on the page (plus optional info-request counts).
// One issue per campaign, highest priority first. No invented stats.

import { campaignNextAction } from "./campaignNextAction.js";

const PRIORITY = {
  info_requests: 10,
  add_companies: 20,
  find_contacts: 30,
  activate: 40,
  no_callers: 50,
};

export function attentionForCampaign({
  campaign,
  companies = 0,
  contacts = 0,
  canProspect = false,
  isManager = true,
  pendingIrCount = 0,
} = {}) {
  if (!campaign?.id) return null;
  if (["completed", "archived"].includes(campaign.status)) return null;

  if (pendingIrCount > 0) {
    return {
      campaignId: campaign.id,
      campaignName: campaign.name || "Campaign",
      id: "info_requests",
      label: pendingIrCount === 1 ? "1 info request waiting" : `${pendingIrCount} info requests waiting`,
      detail: "Reply from Admin inbox",
      href: "/manager-inbox",
      priority: PRIORITY.info_requests,
      count: pendingIrCount,
    };
  }

  const next = campaignNextAction({
    companies,
    contacts,
    status: campaign.status,
    canProspect,
    isManager,
    campaignId: campaign.id,
  });

  if (next.id === "add_companies" || next.id === "waiting_companies") {
    return {
      campaignId: campaign.id,
      campaignName: campaign.name || "Campaign",
      id: "add_companies",
      label: "Needs companies",
      detail: next.detail,
      href: next.href || null,
      priority: PRIORITY.add_companies,
    };
  }

  if (next.id === "find_contacts" || next.id === "waiting_contacts") {
    return {
      campaignId: campaign.id,
      campaignName: campaign.name || "Campaign",
      id: "find_contacts",
      label: "Needs contacts",
      detail: next.detail,
      href: next.href || null,
      priority: PRIORITY.find_contacts,
    };
  }

  if (next.id === "activate") {
    return {
      campaignId: campaign.id,
      campaignName: campaign.name || "Campaign",
      id: "activate",
      label: "Ready to activate",
      detail: next.detail,
      href: null,
      action: "activate",
      priority: PRIORITY.activate,
    };
  }

  const callers = Array.isArray(campaign.assigned_user_ids) ? campaign.assigned_user_ids.filter(Boolean) : [];
  if (campaign.status === "active" && contacts > 0 && callers.length === 0 && isManager) {
    return {
      campaignId: campaign.id,
      campaignName: campaign.name || "Campaign",
      id: "no_callers",
      label: "No callers assigned",
      detail: "Split data or push to the team so someone can dial",
      href: null,
      action: "split",
      priority: PRIORITY.no_callers,
    };
  }

  return null;
}

export function buildCampaignAttentionRollup({
  campaigns = [],
  companyCounts = {},
  contactCounts = {},
  irByCampaign = {},
  canProspect = false,
  isManager = true,
  limit = 8,
} = {}) {
  const items = [];
  for (const campaign of campaigns || []) {
    const item = attentionForCampaign({
      campaign,
      companies: companyCounts[campaign.id] ?? 0,
      contacts: contactCounts[campaign.id] ?? 0,
      canProspect,
      isManager,
      pendingIrCount: irByCampaign[campaign.id] || 0,
    });
    if (item) items.push(item);
  }
  items.sort((a, b) => a.priority - b.priority || a.campaignName.localeCompare(b.campaignName));
  return {
    total: items.length,
    items: items.slice(0, limit),
    campaignIds: items.map((item) => item.campaignId),
  };
}

export function countIrsByCampaign(inboxItems = []) {
  const map = {};
  for (const item of inboxItems || []) {
    const id = item.campaign_id;
    if (!id) continue;
    map[id] = (map[id] || 0) + 1;
  }
  return map;
}
