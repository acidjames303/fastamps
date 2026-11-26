// Lead sheet model and rules.
//
// Pure functions only (no network, no React) so the prefill, the missing-field
// logic and the review lifecycle can be tested against synthetic records.
//
// Nothing here invents an answer: a field is only filled from a value that
// already exists on the call, opportunity, contact, prospect or company record.
// Internal notes are never read into a client-visible field.

export const LEAD_SHEET_STATUSES = {
  draft: { label: "Draft", tone: "gray" },
  submitted: { label: "Submitted", tone: "blue" },
  returned: { label: "Returned", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  sent: { label: "Sent to client", tone: "violet" },
};

export const LEAD_SHEET_STATUS_KEYS = Object.keys(LEAD_SHEET_STATUSES);

// The seven sections of the approved blank form, in order.
export const LEAD_SHEET_SECTIONS = [
  {
    key: "overview",
    number: "01",
    title: "Lead overview",
    fields: [
      { key: "organisation_name", label: "Organisation name", type: "text" },
      { key: "lead_status", label: "Status", type: "text" },
      { key: "date_called", label: "Date called", type: "date" },
      { key: "conversation_details", label: "Conversation details", type: "textarea", dictation: true },
      { key: "next_steps", label: "Next steps", type: "textarea", dictation: true },
    ],
  },
  {
    key: "organisation",
    number: "02",
    title: "Organisation",
    fields: [
      { key: "address_line_1", label: "Address line 1", type: "text" },
      { key: "address_line_2", label: "Address line 2", type: "text" },
      { key: "address_line_3", label: "Address line 3", type: "text" },
      { key: "address_line_4", label: "Address line 4", type: "text" },
      { key: "postcode", label: "Postcode", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "organisation_tel", label: "Telephone", type: "tel" },
    ],
  },
  {
    key: "business",
    number: "03",
    title: "Business",
    fields: [
      { key: "industry", label: "Industry", type: "text" },
      { key: "employees", label: "Employees", type: "text" },
      { key: "turnover", label: "Turnover", type: "text" },
      { key: "nature_of_business", label: "Nature of business", type: "textarea" },
    ],
  },
  {
    key: "qualification",
    number: "04",
    title: "Qualification",
    fields: [
      { key: "qualification_interested", label: "Interested", type: "textarea", dictation: true },
      { key: "qualification_current_systems", label: "Current systems", type: "textarea", dictation: true },
      { key: "qualification_improvements", label: "Improvements sought", type: "textarea", dictation: true },
      { key: "qualification_other_companies", label: "Other companies considered", type: "textarea" },
    ],
  },
  {
    key: "bant",
    number: "05",
    title: "BANT",
    fields: [
      { key: "bant_budget", label: "Budget", type: "text" },
      { key: "bant_authority", label: "Authority", type: "text" },
      { key: "bant_need", label: "Need", type: "textarea", dictation: true },
      { key: "bant_timescale", label: "Timescale", type: "text" },
      { key: "bant_next_action", label: "Next action", type: "text" },
    ],
  },
  {
    key: "contact",
    number: "06",
    title: "Contact",
    fields: [
      { key: "contact_title", label: "Title", type: "text" },
      { key: "contact_name", label: "Name", type: "text" },
      { key: "contact_job_title", label: "Job title", type: "text" },
      { key: "contact_direct_dial", label: "Direct dial", type: "tel" },
      { key: "contact_mobile", label: "Mobile", type: "tel" },
      { key: "contact_email", label: "Direct email", type: "email" },
    ],
  },
  {
    key: "notes",
    number: "07",
    title: "Additional notes",
    fields: [
      { key: "additional_notes", label: "Notes for the client", type: "textarea", dictation: true },
    ],
  },
];

export const LEAD_SHEET_FIELD_KEYS = LEAD_SHEET_SECTIONS.flatMap((section) =>
  section.fields.map((field) => field.key),
);

export const LEAD_SHEET_FIELD_LABELS = LEAD_SHEET_SECTIONS.reduce((acc, section) => {
  for (const field of section.fields) acc[field.key] = field.label;
  return acc;
}, {});

// Fields a reviewer needs to see a value in before a sheet can be submitted.
export const REQUIRED_TO_SUBMIT = ["organisation_name", "contact_name", "date_called"];

export const EDITABLE_STATUSES = ["draft", "returned"];

export const LEAD_SHEET_TRANSITIONS = {
  draft: ["submitted"],
  returned: ["submitted"],
  submitted: ["approved", "returned"],
  approved: ["sent"],
  sent: [],
};

// Callers own drafts; a BDM, sales manager, internal BD or admin reviews them.
export const REVIEW_ROLES = ["platform_owner", "organisation_admin", "sales_manager", "internal_bd"];

export function canTransition(from, to) {
  return (LEAD_SHEET_TRANSITIONS[from] || []).includes(to);
}

export function isEditableStatus(status) {
  return EDITABLE_STATUSES.includes(status);
}

export function canReviewLeadSheet(role) {
  return REVIEW_ROLES.includes(role);
}

export function canEditLeadSheet(sheet, { userId, role } = {}) {
  if (!sheet || !isEditableStatus(sheet.status)) return false;
  return sheet.caller_user_id === userId || role === "platform_owner";
}

export function missingRequiredToSubmit(sheet) {
  return REQUIRED_TO_SUBMIT.filter((key) => !clean(sheet?.[key]));
}

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function firstValue(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
}

function isoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const OUTCOME_INTEREST = {
  connected_interested: "Interested — asked for information",
  connected_information_requested: "Interested — information requested",
  connected_qualified: "Qualified — next step agreed",
  connected_callback: "Interested — callback agreed",
  connected_not_interested: "Not interested",
  connected_wrong_person: "Spoke to the wrong person",
};

const STAGE_LEAD_STATUS = {
  discovered: "Lead",
  qualifying: "Qualified lead — qualification in progress",
  qualified: "Qualified lead",
  meeting_proposed: "Meeting proposed",
  meeting_booked: "Meeting booked",
  handoff_ready: "Ready for handover",
  handed_off: "Handed over",
};

// Build the draft content from records the caller can already see.
// Only known values are returned; anything else stays blank for the caller.
export function buildLeadSheetPrefill({ call, opportunity, contact, prospect, company } = {}) {
  const qualification = (call && call.qualification) || {};
  const outcomeCode = call?.primary_outcome || call?.outcome || "";
  const callbackDate = isoDate(call?.next_action_at);

  return {
    organisation_name: firstValue(company?.name, prospect?.company_name, call?.company, opportunity?.client_name),
    lead_status: firstValue(
      STAGE_LEAD_STATUS[opportunity?.stage],
      OUTCOME_INTEREST[outcomeCode],
      "Lead",
    ),
    date_called: firstValue(isoDate(call?.started_at), isoDate(call?.created_date)),
    // Client-visible notes only — internal notes are never read here.
    conversation_details: firstValue(call?.client_notes),
    next_steps: firstValue(
      opportunity?.next_step,
      qualification.next_step,
      callbackDate ? `Call back on ${callbackDate}` : "",
    ),
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    address_line_4: "",
    postcode: "",
    country: firstValue(prospect?.country_code === "GB" ? "United Kingdom" : "", company?.country === "United Kingdom" ? "United Kingdom" : ""),
    organisation_tel: firstValue(company?.landline, prospect?.company_phone, prospect?.landline),
    industry: firstValue(company?.industry, prospect?.industry),
    employees: firstValue(company?.employee_range, prospect?.employee_range),
    turnover: "",
    nature_of_business: "",
    qualification_interested: firstValue(OUTCOME_INTEREST[outcomeCode]),
    qualification_current_systems: firstValue(qualification.current_solution, opportunity?.current_solution),
    qualification_improvements: firstValue(qualification.pain, opportunity?.pain_points),
    qualification_other_companies: "",
    bant_budget: firstValue(qualification.budget, opportunity?.budget_status),
    bant_authority: firstValue(
      qualification.decision_maker,
      opportunity?.decision_makers,
      opportunity?.authority_status === "unknown" ? "" : opportunity?.authority_status,
    ),
    bant_need: firstValue(qualification.need, opportunity?.need_summary),
    bant_timescale: firstValue(qualification.timing, opportunity?.timing),
    bant_next_action: firstValue(qualification.next_step, opportunity?.next_step),
    contact_title: "",
    contact_name: firstValue(contact?.full_name, call?.contact_name, prospect?.full_name),
    contact_job_title: firstValue(contact?.job_title, prospect?.job_title),
    contact_direct_dial: firstValue(contact?.direct_dial, prospect?.direct_dial),
    contact_mobile: firstValue(contact?.mobile, prospect?.mobile),
    contact_email: firstValue(contact?.email, prospect?.email),
    additional_notes: "",
  };
}

export function prefilledFieldKeys(fields = {}) {
  return LEAD_SHEET_FIELD_KEYS.filter((key) => clean(fields[key]));
}

export function missingLeadSheetFields(sheet = {}) {
  return LEAD_SHEET_FIELD_KEYS.filter((key) => !clean(sheet[key]));
}

export function leadSheetCompletion(sheet = {}) {
  const missing = missingLeadSheetFields(sheet);
  return {
    total: LEAD_SHEET_FIELD_KEYS.length,
    filled: LEAD_SHEET_FIELD_KEYS.length - missing.length,
    missing,
  };
}

// Everything a document may contain. Internal notes are deliberately absent.
export function buildLeadSheetExport(sheet = {}) {
  return LEAD_SHEET_SECTIONS.map((section) => ({
    number: section.number,
    title: section.title,
    rows: section.fields.map((field) => ({
      key: field.key,
      label: field.label,
      value: clean(sheet[field.key]),
    })),
  }));
}

export function leadSheetIdempotencyKey({ source = "dialer", call_log_id, opportunity_id } = {}) {
  const anchor = clean(call_log_id) || clean(opportunity_id);
  return anchor ? `leadsheet:${source}:${anchor}` : "";
}

export function leadSheetFileBaseName(sheet = {}) {
  const name = clean(sheet.organisation_name) || "lead-sheet";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "lead-sheet";
  const date = clean(sheet.date_called) || new Date().toISOString().slice(0, 10);
  return `lead-sheet-${slug}-${date}`;
}

export function formatLeadSheetDate(value) {
  const iso = isoDate(value);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}