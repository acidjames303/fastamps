// Build a human-checked follow-up email draft from an IR / handoff capture.
// Never auto-sends — admin / permitted callers save to drafts or copy the text.

function displayName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  // Email local-part or dotted login → "James P Riches"
  if (!s.includes(" ") && (s.includes("@") || /[._]/.test(s))) {
    const local = (s.includes("@") ? s.split("@")[0] : s).replace(/[._]+/g, " ");
    return local.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

function firstName(raw) {
  return displayName(raw).split(/\s+/)[0] || "";
}

function cleanTopic(topic) {
  let t = String(topic || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  // Strip leading filler that makes "regarding they wanted…"
  t = t.replace(/^(regarding|about|re:?)\s+/i, "");
  t = t.replace(/^(they|he|she|we)\s+(wanted|asked|requested)\s+(to\s+)?/i, "");
  // "book a meeting" → "booking a meeting" for natural "You asked about…"
  t = t.replace(/^book\s+/i, "booking ");
  if (t.length) t = t.charAt(0).toLowerCase() + t.slice(1);
  return t.replace(/[.]+$/, "");
}

function topicForSubject(topicClean) {
  if (!topicClean) return "Following up";
  // Prefer noun form in subject lines
  let s = topicClean.replace(/^booking\s+/i, "Meeting — ");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

function formatNotesForDraft(notes) {
  const raw = String(notes || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  // Light polish only — admin still edits before sending.
  let s = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

/**
 * Follow-up email after an information request.
 *
 * perspective "team"   — the admin writes it and thanks the client for
 *                        speaking with the caller by name (default).
 * perspective "caller" — written personally by the caller who made the call.
 */
export function buildInfoRequestEmailDraft({
  contactName,
  companyName,
  topic,
  clientNotes,
  callerName,
  senderName,
  offer,
  campaignName,
  accountManagerName,
  perspective = "team",
}) {
  const first = (contactName || "").trim().split(/\s+/)[0] || "there";
  const topicClean = cleanTopic(topic);
  const notesClean = formatNotesForDraft(clientNotes);
  const offerClean = String(offer || "").trim().replace(/\s+/g, " ");
  const speaker = displayName(callerName);
  const speakerFirst = firstName(callerName);
  const personal = perspective === "caller";
  // Personal: the caller signs. Team: the admin signs and names the caller.
  const signer = personal ? speaker : displayName(senderName) || speaker;

  const subjectTopic = topicClean
    ? topicForSubject(topicClean)
    : String(campaignName || "").trim() || "Following up";
  const subject = companyName ? `${companyName} — ${subjectTopic}` : subjectTopic;

  const greeting = personal
    ? "Thank you for taking the time to speak with me earlier."
    : speakerFirst
      ? `Thank you for taking the time to speak with ${speakerFirst} earlier.`
      : "Thank you for your time earlier — it was good to speak.";

  const bodyLines = [`Hi ${first},`, "", greeting, ""];

  if (topicClean) {
    bodyLines.push(`You asked about ${topicClean} — I've set out the details below.`, "");
  } else {
    bodyLines.push("I'm following up on that conversation.", "");
  }

  if (offerClean) {
    bodyLines.push(
      personal
        ? "As I mentioned, we can help with the following:"
        : speakerFirst
          ? `As ${speakerFirst} mentioned, we can help with the following:`
          : "We can help with the following:",
      "",
      offerClean,
      "",
    );
  }

  if (notesClean) {
    bodyLines.push(notesClean, "");
    bodyLines.push(
      "[Please edit the paragraph above into the exact wording you want the client to receive before sending.]",
      "",
    );
  } else {
    bodyLines.push(
      "• [Add the information, links, or materials they requested]",
      "• [Include any agreed next step or meeting time]",
      "",
    );
  }

  bodyLines.push(
    "Happy to jump on a short call if anything needs clarifying.",
    "",
    "Kind regards,",
    signer || "[Your name]",
  );

  if (accountManagerName && displayName(accountManagerName) !== signer) {
    bodyLines.push("", `I've also copied ${displayName(accountManagerName)} for visibility.`);
  }

  return {
    subject,
    body: bodyLines.join("\n").replace(/\n{3,}/g, "\n\n"),
  };
}

export function buildMailtoHref({ to, cc, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  if (cc) params.set("cc", cc);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(to || "")}?${qs}`;
}

/** Who may save a draft into Gmail/Outlook from Cadence. */
export function canSaveEmailDraft({ appRole, managedByUserId, campaignAllowsCallerEmail }) {
  if (["platform_owner", "organisation_admin", "sales_manager"].includes(appRole)) {
    return true;
  }
  if (appRole === "bdm") {
    // Solo SDR (no managing BDM) or campaign permission from admin.
    if (campaignAllowsCallerEmail) return true;
    if (!managedByUserId) return true;
    return false;
  }
  return false;
}