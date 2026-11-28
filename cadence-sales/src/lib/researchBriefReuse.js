/** Cap Outreach batch instructions to the same limit as the generate UI. */
export const INSTRUCTION_MAX = 1500;

/** Built-in angles when no ResearchBrief is saved yet — fewer blank-page decisions. */
export const OUTREACH_INSTRUCTION_PRESETS = [
  {
    id: "lead_fact",
    label: "Lead with research fact",
    text: "Open with the contact's cited research fact, then one clear next step. Do not invent details beyond the source.",
  },
  {
    id: "short_ask",
    label: "Short ask",
    text: "Keep to three short paragraphs. Ask for a 15-minute call. Stay consultative and specific.",
  },
  {
    id: "gentle_follow_up",
    label: "Gentle follow-up",
    text: "Reference the earlier touch briefly, restate value in one sentence, and offer an easy yes or no.",
  },
];

export function briefInstructionText(brief, max = INSTRUCTION_MAX) {
  return String(brief?.instruction || brief?.text || "").trim().slice(0, max);
}

/** Prefer recently used briefs, then newest. */
export function sortResearchBriefs(briefs = []) {
  return [...(briefs || [])].sort((a, b) => {
    const aUsed = new Date(a?.last_used_at || 0).getTime();
    const bUsed = new Date(b?.last_used_at || 0).getTime();
    if (aUsed !== bUsed) return bUsed - aUsed;
    return new Date(b?.created_date || 0).getTime() - new Date(a?.created_date || 0).getTime();
  });
}
