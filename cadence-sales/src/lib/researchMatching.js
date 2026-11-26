// Client-side preview of how a research document's account headings line up with
// the accounts already in a campaign. The backend is authoritative, but showing
// the same rule here means ambiguous or unmatched headings are reviewed before
// anything is filed — never guessed.

const IGNORED = new Set([
  "ltd", "limited", "plc", "llp", "inc", "the", "and", "of", "group", "holdings",
  "uk", "cic", "company", "co", "services",
]);

export function nameTokens(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !IGNORED.has(token));
}

export function normalisedCompanyName(name) {
  return nameTokens(name).join(" ");
}

// One heading → one outcome. "matched" only when the names are identical once
// legal suffixes are ignored; anything close but not identical is "ambiguous" so
// a person chooses.
export function classifyHeading(heading, prospects = []) {
  const wanted = normalisedCompanyName(heading);
  if (!wanted) return { status: "unmatched", prospect: null, candidates: [] };

  const exact = prospects.find((prospect) => normalisedCompanyName(prospect.company_name) === wanted);
  if (exact) return { status: "matched", prospect: exact, candidates: [] };

  const wantedTokens = nameTokens(heading);
  const candidates = prospects
    .map((prospect) => {
      const have = new Set(nameTokens(prospect.company_name));
      if (!have.size) return null;
      const overlap = wantedTokens.filter((token) => have.has(token)).length;
      if (!overlap) return null;
      const score = overlap / Math.max(wantedTokens.length, have.size);
      if (score < 0.4) return null;
      return { id: prospect.id, company_name: prospect.company_name, score: Math.round(score * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    status: candidates.length ? "ambiguous" : "unmatched",
    prospect: null,
    candidates,
  };
}

export function classifySections(sections = [], prospects = []) {
  return sections.map((section) => ({
    ...section,
    match: classifyHeading(section.company_name, prospects),
    choice: "", // reviewer's explicit account id, or "skip"
  }));
}

export function summariseReview(rows = []) {
  const matched = rows.filter((row) => row.match.status === "matched").length;
  // A heading is resolved once a person has either named the account or marked
  // it as not in this list.
  const needsReview = rows.filter((row) => row.match.status !== "matched" && !row.choice).length;
  return { matched, needsReview, total: rows.length };
}