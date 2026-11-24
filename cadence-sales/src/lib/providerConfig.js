// Provider configuration shared between Settings, Prospecting, and enrichment
// components. This is the frontend mirror of base44/shared/providerResolution.ts.

export const PROVIDER_LABELS = {
  apollo: "Apollo",
  lusha: "Lusha",
  fullenrich: "FullEnrich",
};

export const DEFAULT_PROVIDER_ORDER = ["apollo", "lusha", "fullenrich"];

export const ENRICHABLE_FIELDS = [
  { key: "personal_email", label: "Personal work email", description: "Direct work email for a named decision-maker" },
  { key: "alternative_email", label: "Alternative email", description: "Secondary email if the primary was not found" },
  { key: "mobile", label: "Mobile number", description: "Direct mobile for a decision-maker" },
  { key: "direct_dial", label: "Direct dial", description: "Direct landline for a decision-maker" },
  { key: "company_phone", label: "Company phone", description: "Main switchboard / landline" },
  { key: "decision_maker_role", label: "Decision-maker role", description: "Senior contact name and job title" },
  { key: "company_intelligence", label: "Company intelligence", description: "Industry, size, location, website" },
];