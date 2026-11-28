// Which campaign-card controls stay on the face vs tuck into More.
// Recommended next step (CampaignNextStep) already covers the primary CTA.

export function campaignCardActionSlots({
  isManager = false,
  isAdmin = false,
  canProspect = false,
  status = "draft",
} = {}) {
  const terminal = ["completed", "archived"].includes(status);
  return {
    showPauseActivate: isManager && !terminal,
    showContacts: true,
    showPush: isManager,
    more: [
      isManager && "split",
      "open",
      "data_quality",
      "accounts_notes",
      canProspect && "find_prospects",
      isAdmin && "email_drafts",
      isManager && "delete",
    ].filter(Boolean),
  };
}
