// After spreadsheet import, one ranked next step — not a wall of peer buttons.

export function importNextAction({
  importedCount = 0,
  missingPhone = 0,
  missingEmail = 0,
  numbersCount = 0,
  campaignId = "",
  listId = "",
  canSplit = false,
} = {}) {
  const dialerList = campaignId || listId;
  const dialerHref = dialerList
    ? `/dialer?list=${encodeURIComponent(dialerList)}`
    : null;
  const grow = { cta: "Find similar companies", action: "scroll_grow" };
  const fillPhones = missingPhone > 0
    ? { cta: `Fill phones (${missingPhone})`, action: "fill_phones" }
    : null;
  const fillEmails = missingEmail > 0
    ? { cta: `Find emails (${missingEmail})`, action: "fill_emails" }
    : null;
  const split = canSplit
    ? { cta: "Split data", action: "split" }
    : null;

  if (!importedCount) {
    return {
      id: "empty",
      title: "Nothing imported yet",
      detail: "Add companies from a spreadsheet to continue",
      cta: null,
      href: null,
      action: null,
      kind: "idle",
      secondary: null,
    };
  }

  // Majority still need a dialable number — fill that before calling.
  if (missingPhone > 0 && missingPhone >= Math.ceil(importedCount / 2)) {
    return {
      id: "fill_phones",
      title: "Fill missing phones",
      detail: `${missingPhone} of ${importedCount} still need a mobile or direct dial`,
      cta: fillPhones.cta,
      href: null,
      action: "fill_phones",
      kind: "enrich",
      secondary: grow,
    };
  }

  // Phones look OK; emails are the gap.
  if (missingEmail > 0 && missingEmail >= Math.ceil(importedCount / 2) && missingPhone < Math.ceil(importedCount / 2)) {
    return {
      id: "fill_emails",
      title: "Find work emails",
      detail: `${missingEmail} of ${importedCount} still need an email`,
      cta: fillEmails.cta,
      href: null,
      action: "fill_emails",
      kind: "enrich",
      secondary: grow,
    };
  }

  // Large import with team callers ready — split before everyone dials the same sheet.
  if (canSplit && importedCount >= 20) {
    return {
      id: "split_data",
      title: "Split across the team",
      detail: `${importedCount} accounts — divide by even share, territory, industry, or dictate`,
      cta: split.cta,
      href: null,
      action: "split",
      kind: "split",
      secondary: grow,
    };
  }

  // Callable numbers on a linked list/campaign — go dial.
  if (numbersCount > 0 && dialerHref) {
    return {
      id: "start_calling",
      title: "Ready to call",
      detail: `${numbersCount} number${numbersCount === 1 ? "" : "s"} on ${importedCount} imported account${importedCount === 1 ? "" : "s"}`,
      cta: "Start calling",
      href: dialerHref,
      action: null,
      kind: "call",
      secondary: grow,
    };
  }

  // Default: grow the list from seed (lookalikes + exclusions).
  return {
    id: "find_similar",
    title: "Grow from this seed",
    detail: "Find similar companies outside the list — exclusions stay out",
    cta: grow.cta,
    href: null,
    action: "scroll_grow",
    kind: "grow",
    secondary: fillPhones || (canSplit ? split : fillEmails),
  };
}
