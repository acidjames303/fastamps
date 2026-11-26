// Vocabulary, steps and text composition for the guided campaign builder.
// Everything the wizard collects lands in `answers`; the brief, ICP and research
// instruction are always derived from it so the three stay in step.

export const OBJECTIVE_PILLS = [
  "Book meetings", "Build a target list", "Win back lapsed customers", "Launch a new product",
  "Fill a pipeline gap", "Book discovery calls", "Win new business", "Recruit partners",
];

export const INDUSTRY_PILLS = [
  "Manufacturing", "Food & drink", "Logistics & warehousing", "Construction", "House building",
  "Facilities management", "Energy & utilities", "Healthcare", "Technology / SaaS",
  "Professional services", "Retail & ecommerce", "Financial services", "Education",
  "Public sector", "Telecoms", "Pharmaceutical",
];

export const SIZE_PILLS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export const GEOGRAPHY_PILLS = [
  "United Kingdom", "London & South East", "South West", "Midlands", "North West", "North East",
  "Yorkshire", "Scotland", "Wales", "Northern Ireland", "National (all UK)",
];

export const ROLE_PILLS = [
  "Managing Director", "Owner / Founder", "Operations Director", "Operations Manager",
  "Engineering Manager", "Production Manager", "Technical Director", "Procurement Manager",
  "Head of Procurement", "Facilities Manager", "Head of Estates", "Finance Director",
  "IT Director", "Sustainability Lead", "Commercial Director", "Head of Sales",
];

export const INTELLIGENCE_PILLS = [
  "Company overview", "Products & services", "Sites & locations", "Recent news", "Hiring signals",
  "Technology in use", "Financials", "Competitors", "Leadership team", "Growth plans",
];

export const CONTRACT_PILLS = [
  "Contract awards", "Incumbent supplier", "Contract value", "Contract start date",
  "Contract expiry date", "Renewal window", "Live tenders", "Framework agreements",
  "Procurement notices",
];

export const SIGNAL_PILLS = [
  "New site or expansion", "Funding round", "Acquisition or merger", "Leadership change",
  "Hiring spike", "Contract expiring", "Tender published", "Digital transformation",
  "Cost reduction drive", "Sustainability targets",
];

export const SOURCE_PILLS = [
  "Company website", "Companies House", "News & press", "LinkedIn", "Trade press",
  "Procurement portals", "Job adverts", "Regulator filings", "Annual reports",
];

export const OUTPUT_FORMATS = [
  { key: "call_brief", label: "Short call brief", detail: "three or four lines a caller can read before dialling" },
  { key: "findings_table", label: "Structured findings", detail: "one labelled line per finding, each with its source" },
  { key: "account_report", label: "Detailed account report", detail: "a short narrative followed by sourced findings" },
  { key: "bullets", label: "Bullet summary", detail: "plain bullets with no narrative" },
];

export const ENRICHMENT_PILLS = [
  { key: "mobile", label: "Mobile number" },
  { key: "direct_dial", label: "Direct dial" },
  { key: "company_phone", label: "Company switchboard" },
  { key: "personal_email", label: "Work email" },
  { key: "decision_maker_role", label: "Decision-maker name & role" },
  { key: "company_intelligence", label: "Company intelligence" },
];

export const PROVIDER_PILLS = [
  { key: "lusha", label: "Lusha" },
  { key: "apollo", label: "Apollo" },
  { key: "fullenrich", label: "FullEnrich" },
];

export const RENEWAL_WINDOWS = ["Within 3 months", "3-6 months", "6-12 months", "Any time"];

export const BUILDER_STEPS = [
  {
    key: "objective", kind: "single", title: "What is this campaign for?",
    help: "One line keeps the brief and the research pointed at the same outcome.",
    options: OBJECTIVE_PILLS, customLabel: "Something else",
  },
  {
    key: "offer", kind: "text", title: "What are you selling?",
    help: "Plain words. Lead with the outcome the buyer gets, not the product name.",
    placeholder: "e.g. Planned maintenance cover for commercial laundry sites — a fixed monthly cost and one number to call.",
  },
  {
    key: "industries", kind: "multi", title: "Which industries?",
    help: "Pick every sector worth calling. Add your own if it is missing.",
    options: INDUSTRY_PILLS, customLabel: "Add an industry",
  },
  {
    key: "sizes", kind: "multi", title: "What size of company?",
    help: "Employee bands. Skip this if size does not decide the fit.",
    options: SIZE_PILLS,
  },
  {
    key: "geography", kind: "multi", title: "Where should they be?",
    help: "Cadence keeps accounts inside this footprint.",
    options: GEOGRAPHY_PILLS, customLabel: "Add a region",
  },
  {
    key: "roles", kind: "multi", title: "Who do you want to speak to?",
    help: "Job titles worth dialling. Order does not matter — Cadence ranks them.",
    options: ROLE_PILLS, customLabel: "Add a job title",
  },
  {
    key: "intelligence", kind: "multi", title: "What should we know about each company?",
    help: "Cadence researches these for every account in the list.",
    options: INTELLIGENCE_PILLS, customLabel: "Add something to find",
  },
  {
    key: "contracts", kind: "multi", title: "Any contract detail worth chasing?",
    help: "Useful when the timing depends on a renewal, an award or a live tender.",
    options: CONTRACT_PILLS, customLabel: "Add contract detail",
  },
  {
    key: "signals", kind: "multi", title: "What makes an account worth calling now?",
    help: "Buying signals. These decide which accounts get prioritised.",
    options: SIGNAL_PILLS, customLabel: "Add a signal",
  },
  {
    key: "sources", kind: "multi", title: "Where should research look?",
    help: "Cadence only records what it can source, so name the places worth checking.",
    options: SOURCE_PILLS, customLabel: "Add a source",
  },
  {
    key: "output_format", kind: "single", title: "How should findings come back?",
    help: "This shapes what a caller reads before dialling.",
    options: OUTPUT_FORMATS,
  },
  {
    key: "enrichment", kind: "multi", title: "Which details should we fill in?",
    help: "Used when you enrich the accounts you find or import.",
    options: ENRICHMENT_PILLS,
  },
  {
    key: "provider_order", kind: "multi", ordered: true, title: "Provider priority",
    help: "Tap in the order Cadence should try them. Only connected providers are called.",
    options: PROVIDER_PILLS,
  },
];

export function emptyAnswers() {
  return {
    objective: "",
    offer: "",
    industries: [],
    sizes: [],
    geography: ["United Kingdom"],
    roles: [],
    intelligence: ["Company overview", "Recent news"],
    contracts: [],
    contract_focus: "",
    signals: [],
    sources: ["Company website"],
    output_format: "findings_table",
    enrichment: ["mobile", "direct_dial", "personal_email", "decision_maker_role"],
    provider_order: ["lusha", "apollo", "fullenrich"],
  };
}

export function emptyDraft() {
  return {
    method: "",
    answers: emptyAnswers(),
    brief: "",
    icp: "",
    instruction: "",
    template_id: "",
    template_name: "",
  };
}

// Follow-ups only appear when the answers before them made them relevant.
export function followUpSteps(answers = {}) {
  const steps = [];
  if ((answers.contracts || []).length) {
    steps.push({
      key: "contract_focus", kind: "text", title: "Anything specific about those contracts?",
      help: "A supplier, a value threshold or a renewal window to look for. Optional.",
      placeholder: "e.g. Contracts over £250k with a renewal inside the next twelve months",
    });
  }
  if ((answers.signals || []).includes("Contract expiring")) {
    steps.push({
      key: "renewal_window", kind: "single", title: "How soon is a renewal worth chasing?",
      help: "Cadence prioritises accounts whose contracts end inside this window.",
      options: RENEWAL_WINDOWS,
    });
  }
  const customIndustry = (answers.industries || []).find((item) => !INDUSTRY_PILLS.includes(item));
  if (customIndustry) {
    steps.push({
      key: "industry_detail", kind: "text", title: `Tell me about ${customIndustry}`,
      help: "What do those companies do, and what makes them a fit?",
      placeholder: "e.g. Independent breweries running their own canning lines",
    });
  }
  return steps;
}

const labelOf = (option) => (typeof option === "string" ? option : option?.label || "");

function listText(values) {
  return (values || []).map(labelOf).filter(Boolean).join(", ");
}

export function outputFormatDetail(key) {
  return OUTPUT_FORMATS.find((format) => format.key === key)?.detail || "one labelled line per finding";
}

export function composeBrief(answers = {}) {
  const lines = [];
  const push = (label, value) => {
    if (value && String(value).trim()) lines.push(`${label}: ${String(value).trim()}`);
  };
  push("Objective", answers.objective);
  push("What we sell", answers.offer);
  push("Target industries", listText(answers.industries));
  push("Company size", listText(answers.sizes));
  push("Geography", listText(answers.geography));
  push("Who we call", listText(answers.roles));
  push("Buying signals", listText(answers.signals));
  push("Contract detail to chase", listText(answers.contracts));
  if (answers.contract_focus) push("Contract focus", answers.contract_focus);
  if (answers.renewal_window) push("Renewal window", answers.renewal_window);
  if (answers.industry_detail) push("Industry detail", answers.industry_detail);
  return lines.join("\n");
}

export function composeIcp(answers = {}) {
  const industries = listText(answers.industries) || "B2B companies";
  const sizes = listText(answers.sizes);
  const geography = listText(answers.geography) || "the United Kingdom";
  const roles = listText(answers.roles) || "the people who own the problem";
  const signals = listText(answers.signals);
  const sizeText = sizes ? `${sizes} employee ` : "";
  const signalText = signals ? ` Accounts worth calling first show: ${signals.toLowerCase()}.` : "";
  return `${sizeText}${industries} businesses in ${geography}. The people to reach are ${roles}.${signalText}`.trim();
}

export function composeInstruction(answers = {}) {
  const parts = [];
  const intelligence = listText(answers.intelligence);
  parts.push(
    intelligence
      ? `For each account, record ${intelligence.toLowerCase()}.`
      : "For each account, record a short overview of the business.",
  );
  if ((answers.contracts || []).length) {
    parts.push(`Capture contract detail: ${listText(answers.contracts).toLowerCase()}.`);
  }
  if (answers.contract_focus) parts.push(`Prioritise ${answers.contract_focus.replace(/^prioritise\s+/i, "")}.`);
  if (answers.renewal_window) parts.push(`Flag renewals inside ${answers.renewal_window.toLowerCase()}.`);
  if (answers.industry_detail) parts.push(`Context on the industry: ${answers.industry_detail}.`);
  if ((answers.sources || []).length) {
    parts.push(`Check ${listText(answers.sources).toLowerCase()}.`);
  }
  parts.push(
    `Return ${outputFormatDetail(answers.output_format)}, with the source link and date beside every finding.`,
  );
  parts.push("Keep published findings separate from anything the customer has confirmed.");
  return parts.join(" ");
}

export function composeFromAnswers(answers) {
  return {
    brief: composeBrief(answers),
    icp: composeIcp(answers),
    instruction: composeInstruction(answers),
  };
}

// A worked example kept in the app so a new team member can start from a
// proven shape without hunting for an old campaign.
export const BUILT_IN_TEMPLATES = [
  {
    id: "builtin-contract-research",
    name: "Contract & tender research (Tunstall style)",
    description: "Find accounts whose contracts, suppliers and renewal dates are published, then brief the caller on the timing.",
    answers: {
      ...emptyAnswers(),
      objective: "Build a target list",
      offer: "Replacing analogue telecare and connected care systems with a digital service",
      industries: ["Healthcare", "Public sector", "Facilities management"],
      sizes: ["201-500", "501-1000", "1000+"],
      geography: ["United Kingdom"],
      roles: ["Head of Estates", "Operations Director", "Procurement Manager", "IT Director"],
      intelligence: ["Company overview", "Sites & locations", "Technology in use", "Recent news"],
      contracts: [
        "Contract awards", "Incumbent supplier", "Contract value", "Contract start date",
        "Contract expiry date", "Renewal window", "Live tenders",
      ],
      contract_focus: "Published awards with a value and an expiry date",
      signals: ["Contract expiring", "Tender published"],
      renewal_window: "6-12 months",
      sources: ["Procurement portals", "Companies House", "Trade press", "Company website"],
      output_format: "findings_table",
    },
  },
];

export function draftFromTemplate(template) {
  const answers = { ...emptyAnswers(), ...(template.answers || {}) };
  const composed = composeFromAnswers(answers);
  return {
    method: "guided",
    answers,
    brief: template.brief || composed.brief,
    icp: template.icp || composed.icp,
    instruction: template.research_instruction || composed.instruction,
    template_id: template.id || "",
    template_name: template.name || "",
  };
}

const draftKey = (scope) => `cadence_campaign_builder_${scope || "new"}`;

export function loadDraft(scope) {
  try {
    const raw = localStorage.getItem(draftKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...emptyDraft(),
      ...parsed,
      answers: { ...emptyAnswers(), ...(parsed.answers || {}) },
    };
  } catch {
    return null;
  }
}

export function saveDraft(scope, draft) {
  try {
    localStorage.setItem(draftKey(scope), JSON.stringify(draft));
  } catch {
    // A full or blocked storage quota must never stop someone building a brief.
  }
}

export function clearDraft(scope) {
  try {
    localStorage.removeItem(draftKey(scope));
  } catch {
    // Ignore: nothing depends on the stored draft.
  }
}