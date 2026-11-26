// One recommended next step from campaign progress — keeps Cadence feeling guided
// without inventing a second workflow or a chatbot.

export function campaignNextAction({
  companies = 0,
  contacts = 0,
  status = "draft",
  canProspect = false,
  isManager = false,
  campaignId = "",
} = {}) {
  const prospectHref = `/campaigns?tab=prospect&campaign=${encodeURIComponent(campaignId)}`;
  const importHref = `/campaigns?tab=prospect&import=1&campaign=${encodeURIComponent(campaignId)}`;
  const dialerHref = `/dialer?list=${encodeURIComponent(campaignId)}`;
  const contactsHref = `/contacts?campaign=${encodeURIComponent(campaignId)}`;

  if (!companies) {
    if (canProspect) {
      return {
        id: "add_companies",
        label: "Add companies",
        detail: "Import a spreadsheet or describe who to find",
        href: importHref,
        secondaryHref: prospectHref,
        secondaryLabel: "Find prospects",
      };
    }
    return {
      id: "waiting_companies",
      label: "Waiting for companies",
      detail: "A manager still needs to build this list",
      href: null,
    };
  }

  if (!contacts) {
    if (canProspect) {
      return {
        id: "find_contacts",
        label: "Find contacts",
        detail: `${companies} compan${companies === 1 ? "y" : "ies"} ready — add people to call`,
        href: prospectHref,
      };
    }
    return {
      id: "waiting_contacts",
      label: "Waiting for contacts",
      detail: `${companies} compan${companies === 1 ? "y" : "ies"} on the list — enrichment still needed`,
      href: null,
    };
  }

  if (isManager && status !== "active" && !["completed", "archived"].includes(status)) {
    return {
      id: "activate",
      label: "Activate to dial",
      detail: `${contacts} contact${contacts === 1 ? "" : "s"} ready — activate before callers start`,
      href: null,
      action: "activate",
    };
  }

  return {
    id: "start_calling",
    label: "Start calling",
    detail: `${contacts} contact${contacts === 1 ? "" : "s"} ready`,
    href: dialerHref,
    secondaryHref: contactsHref,
    secondaryLabel: "Review contacts",
  };
}

export function todayNextAction({
  dueNow = 0,
  overdue = 0,
  newProspects = 0,
  pendingIrs = 0,
  canProspect = false,
  isAdmin = false,
  hasCallingWork = false,
  lastDialResume = null,
} = {}) {
  if (dueNow > 0 || overdue > 0) {
    return {
      id: "continue_calling",
      title: dueNow > 0 ? "Callbacks need you now" : "Overdue callbacks waiting",
      detail: dueNow > 0
        ? `${dueNow} due now${overdue ? ` · ${overdue} overdue` : ""} — pick up where you left off`
        : `${overdue} overdue — clear these before new dialling`,
      cta: "Start calling",
      kind: "call",
    };
  }

  if (lastDialResume?.companyId) {
    const company = lastDialResume.companyName || "your last company";
    const campaign = lastDialResume.campaignName ? ` · ${lastDialResume.campaignName}` : "";
    const params = new URLSearchParams();
    if (lastDialResume.listId) params.set("list", lastDialResume.listId);
    params.set("company", lastDialResume.companyId);
    return {
      id: "resume_dial",
      title: `Continue at ${company}`,
      detail: `Resume where you left off${campaign}`,
      cta: "Open Dialer",
      kind: "resume",
      href: `/dialer?${params.toString()}`,
    };
  }

  if (newProspects > 0 || hasCallingWork) {
    return {
      id: "new_prospects",
      title: "Fresh prospects are ready",
      detail: newProspects > 0
        ? `${newProspects} new prospect${newProspects === 1 ? "" : "s"} in your queue`
        : "You have call-ready work waiting",
      cta: "Start calling",
      kind: "call",
    };
  }

  if (isAdmin && pendingIrs > 0) {
    return {
      id: "admin_inbox",
      title: "Info requests need a reply",
      detail: `${pendingIrs} waiting in Admin inbox`,
      cta: "Open inbox",
      kind: "inbox",
      href: "/manager-inbox",
    };
  }

  if (canProspect) {
    return {
      id: "build_pipeline",
      title: "Build today’s pipeline",
      detail: "Import research, describe a campaign, or continue existing work",
      cta: "Find prospects",
      kind: "prospect",
      href: "/campaigns?tab=prospect",
    };
  }

  return {
    id: "caught_up",
    title: "You're caught up",
    detail: "Nothing due right now — check back when new work is pushed to you",
    cta: null,
    kind: "idle",
  };
}
