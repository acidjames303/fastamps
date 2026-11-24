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

export function buildInfoRequestEmailDraft({
  contactName,
  companyName,
  topic,
  clientNotes,
  callerName,
  accountManagerName,
}) {
  const first = (contactName || "").trim().split(/\s+/)[0] || "there";
  const topicClean = cleanTopic(topic);
  const notesClean = formatNotesForDraft(clientNotes);
  const signer = displayName(callerName);

  const subjectTopic = topicForSubject(topicClean);
  const subject = companyName ? `${companyName} — ${subjectTopic}` : subjectTopic;

  const bodyLines = [
    `Hi ${first},`,
    "",
    "Thank you for your time earlier — it was good to speak.",
    "",
  ];

  if (topicClean) {
    bodyLines.push(`You asked about ${topicClean}. I've summarised the key points below:`);
  } else {
    bodyLines.push("As discussed, I've summarised the key points below:");
  }
  bodyLines.push("");

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

  if (accountManagerName) {
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
