// After enrichment finishes, point people at the useful next step —
// call, outreach, or review — instead of a vague “look at Prospecting”.

export function enrichmentNextAction({
  listId = "",
  completed = 0,
  partial = 0,
  failed = 0,
  phonesFound = 0,
  emailsFound = 0,
  contactsFound = 0,
  onProspectingPage = false,
} = {}) {
  const reviewHref = listId
    ? `/campaigns?tab=prospect&list=${encodeURIComponent(listId)}`
    : "/campaigns?tab=prospect";
  const dialerHref = listId
    ? `/dialer?list=${encodeURIComponent(listId)}`
    : "/dialer";

  if (failed > 0 && failed >= Math.max(completed, 1) && phonesFound === 0 && emailsFound === 0) {
    return {
      id: "review_failures",
      title: "Review records that need attention",
      detail: `${failed} failed${partial ? ` · ${partial} partial` : ""} — fix or re-run before calling`,
      cta: onProspectingPage ? "Show needs attention" : "Review results",
      href: onProspectingPage ? null : reviewHref,
      action: onProspectingPage ? "filter_attention" : null,
      kind: "review",
      secondary: null,
    };
  }

  if (phonesFound > 0) {
    return {
      id: "start_calling",
      title: "Ready to call",
      detail: `${phonesFound} number${phonesFound === 1 ? "" : "s"} found — open Dialer or continue in Outreach`,
      cta: "Start calling",
      href: dialerHref,
      kind: "call",
      secondary: {
        cta: "Open Outreach",
        href: "/outreach",
      },
    };
  }

  if (emailsFound > 0 || contactsFound > 0) {
    const people = contactsFound || emailsFound;
    return {
      id: "outreach_ready",
      title: "Contacts ready for Outreach",
      detail: emailsFound > 0
        ? `${emailsFound} email${emailsFound === 1 ? "" : "s"} found — draft personalised outreach`
        : `${people} contact${people === 1 ? "" : "s"} found — review, then call or email`,
      cta: "Open Outreach",
      href: "/outreach",
      kind: "outreach",
      secondary: onProspectingPage
        ? { cta: "Show needs attention", href: null, action: "filter_attention" }
        : { cta: "Review results", href: reviewHref },
    };
  }

  if (completed > 0 || partial > 0) {
    return {
      id: "review_results",
      title: "Enrichment finished — review what came back",
      detail: `${completed} complete${partial ? ` · ${partial} partial` : ""}${failed ? ` · ${failed} failed` : ""}`,
      cta: onProspectingPage ? "Show needs attention" : "Review results",
      href: onProspectingPage ? null : reviewHref,
      action: onProspectingPage ? "filter_attention" : null,
      kind: "review",
      secondary: {
        cta: "Start calling",
        href: dialerHref,
      },
    };
  }

  return {
    id: "review_empty",
    title: "Enrichment finished",
    detail: "Open the list to see what was returned",
    cta: onProspectingPage ? null : "Review results",
    href: onProspectingPage ? null : reviewHref,
    kind: "review",
    secondary: null,
  };
}

// Session-level fallback when we only have EnrichmentSession counts
// (header toast / banner away from the table).
export function enrichmentSessionNextAction(session = {}, { onProspectingPage = false } = {}) {
  const listId = session.prospect_list_id || session.list_id || "";
  const completed = session.completed_count || 0;
  const partial = session.partial_count || 0;
  const failed = session.failed_count || 0;
  const cached = session.cached_count || 0;
  // Without per-field metrics, treat successful completes as call-ready enough
  // to offer Dialer — users still land on the right list.
  const useful = completed + cached;
  return enrichmentNextAction({
    listId,
    completed: useful,
    partial,
    failed,
    phonesFound: useful > 0 ? useful : 0,
    emailsFound: 0,
    contactsFound: 0,
    onProspectingPage,
  });
}
