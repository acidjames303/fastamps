/**
 * Lightweight sticky campaign context for Phase 1.
 * Survives Prospecting ↔ Calling ↔ Outreach within the same browser.
 * Does not replace server campaign assignment — it only retains the user's last focus.
 */

const KEY = "cadence_active_campaign_v1";

export function getActiveCampaign() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveCampaign(campaign) {
  if (!campaign?.id) {
    clearActiveCampaign();
    return null;
  }
  const next = {
    id: campaign.id,
    name: campaign.name || campaign.title || "Campaign",
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("cadence:campaign-context", { detail: next }));
  return next;
}

export function clearActiveCampaign() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("cadence:campaign-context", { detail: null }));
}
