// Pure helpers for splitting campaign accounts between callers —
// even (50/50), by UK territory, by industry, or from a dictated instruction.

export const UK_TERRITORIES = [
  {
    id: "northwest",
    label: "North West",
    match: /\b(north\s*west|manchester|liverpool|lancashire|cheshire|cumbria|merseyside|preston|blackpool|bolton|wigan|stockport|salford|oldham|rochdale|burnley|blackburn)\b/i,
  },
  {
    id: "northeast",
    label: "North East",
    match: /\b(north\s*east|newcastle|durham|tyne|teesside|sunderland|middlesbrough|gateshead|hartlepool)\b/i,
  },
  {
    id: "yorkshire",
    label: "Yorkshire & Humber",
    match: /\b(yorkshire|humber|leeds|sheffield|bradford|hull|york|wakefield|doncaster|huddersfield|halifax|rotherham)\b/i,
  },
  {
    id: "midlands",
    label: "Midlands",
    match: /\b(midlands|birmingham|nottingham|leicester|derby|coventry|stoke|wolverhampton|worcester|lincoln|northampton|warwick)\b/i,
  },
  {
    id: "southeast",
    label: "South East & London",
    match: /\b(south\s*east|london|surrey|kent|sussex|essex|hampshire|berkshire|buckingham|oxford|reading|brighton|southampton|portsmouth|slough|watford|croydon|canterbury)\b/i,
  },
  {
    id: "southwest",
    label: "South West",
    match: /\b(south\s*west|bristol|cornwall|devon|somerset|dorset|wiltshire|gloucester|plymouth|exeter|bath|bournemouth|swindon)\b/i,
  },
  {
    id: "scotland",
    label: "Scotland",
    match: /\b(scotland|glasgow|edinburgh|aberdeen|dundee|inverness|fife|lanark)\b/i,
  },
  {
    id: "wales",
    label: "Wales",
    match: /\b(wales|cardiff|swansea|newport|wrexham|bangor)\b/i,
  },
  {
    id: "northern_ireland",
    label: "Northern Ireland",
    match: /\b(northern\s*ireland|belfast|antrim|derry|londonderry|armagh)\b/i,
  },
];

export function classifyTerritory(location = "") {
  const text = String(location || "").trim();
  if (!text) return { id: "unknown", label: "Unknown / no location" };
  for (const territory of UK_TERRITORIES) {
    if (territory.match.test(text)) return { id: territory.id, label: territory.label };
  }
  if (/\bunited\s*kingdom\b|\buk\b|\bengland\b/i.test(text)) {
    return { id: "uk_unspecified", label: "UK (unspecified region)" };
  }
  return { id: "other", label: "Other / overseas" };
}

export function normaliseIndustry(value = "") {
  const text = String(value || "").trim();
  if (!text) return "Unspecified industry";
  return text.split(/[>|/•]/)[0].trim() || "Unspecified industry";
}

export function bucketByTerritory(accounts = []) {
  const buckets = new Map();
  for (const account of accounts) {
    const territory = classifyTerritory(account.location || account.territory || "");
    if (!buckets.has(territory.id)) {
      buckets.set(territory.id, { id: territory.id, label: territory.label, accounts: [] });
    }
    buckets.get(territory.id).accounts.push(account);
  }
  return [...buckets.values()].sort((a, b) => b.accounts.length - a.accounts.length);
}

export function bucketByIndustry(accounts = []) {
  const buckets = new Map();
  for (const account of accounts) {
    const label = normaliseIndustry(account.industry);
    const id = label.toLowerCase();
    if (!buckets.has(id)) buckets.set(id, { id, label, accounts: [] });
    buckets.get(id).accounts.push(account);
  }
  return [...buckets.values()].sort((a, b) => b.accounts.length - a.accounts.length);
}

// Even / 50-50 (or N-way) split — round-robin for a mixed spread.
export function splitEven(accounts = [], userIds = []) {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) return [];
  const piles = ids.map((userId) => ({ userId, accounts: [] }));
  accounts.forEach((account, index) => {
    piles[index % piles.length].accounts.push(account);
  });
  return piles;
}

// Assign whole buckets to callers in round-robin (keeps territories/industries together).
export function assignBucketsRoundRobin(buckets = [], userIds = []) {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) return [];
  const piles = ids.map((userId) => ({ userId, accounts: [], buckets: [] }));
  buckets.forEach((bucket, index) => {
    const pile = piles[index % piles.length];
    pile.buckets.push({ id: bucket.id, label: bucket.label, count: bucket.accounts.length });
    pile.accounts.push(...bucket.accounts);
  });
  return piles;
}

// Map named territories onto selected callers, e.g.
// [{ userId, territories: ['northwest','scotland'] }, ...]
export function assignByTerritoryMap(accounts = [], territoryMap = []) {
  const piles = (territoryMap || []).map((row) => ({
    userId: row.userId,
    accounts: [],
    territories: row.territories || [],
  }));
  const claimed = new Set();
  for (const account of accounts) {
    const territory = classifyTerritory(account.location || account.territory || "");
    const pile = piles.find((row) => (row.territories || []).includes(territory.id));
    if (pile) {
      pile.accounts.push(account);
      claimed.add(account.id || account.company_id);
    }
  }
  // Leftovers go evenly across callers so nothing is stranded.
  const leftovers = accounts.filter((account) => !claimed.has(account.id || account.company_id));
  leftovers.forEach((account, index) => {
    if (!piles.length) return;
    piles[index % piles.length].accounts.push(account);
  });
  return piles;
}

// Lightweight dictate parser for common BDM phrases without calling AI.
// Returns { mode, territoryMap? } or null when the text needs the model.
export function parseSplitInstruction(text = "", callers = []) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const names = (callers || []).map((c) => ({
    userId: c.user_id || c.userId,
    name: String(c.full_name || c.name || "").trim(),
    tokens: String(c.full_name || c.name || "").toLowerCase().split(/\s+/).filter(Boolean),
  })).filter((c) => c.userId && c.name);

  if (/\b(50\s*\/?\s*50|fifty[-\s]?fifty|even|half\s+and\s+half|split\s+evenly|equal)\b/i.test(lower)) {
    return { mode: "even", confidence: "rule" };
  }
  if (/\b(industr(y|ies)|sector|vertical)\b/i.test(lower)) {
    return { mode: "by_industry", confidence: "rule" };
  }

  const territoryHits = UK_TERRITORIES.filter((t) => t.match.test(raw) || lower.includes(t.label.toLowerCase()));
  if (territoryHits.length && names.length >= 2) {
    // "Aileen northwest, Malcolm southeast"
    const map = names.map((person) => {
      const territories = [];
      for (const territory of territoryHits) {
        const personMention = person.tokens.some((token) => token.length > 2 && lower.includes(token));
        const near = new RegExp(`${person.tokens.filter((t) => t.length > 2).join("|")}.{0,40}${territory.label.split(" ")[0]}|${territory.label.split(" ")[0]}.{0,40}${person.tokens.filter((t) => t.length > 2).join("|")}`, "i");
        if (personMention && near.test(raw)) territories.push(territory.id);
      }
      return { userId: person.userId, territories };
    });
    if (map.some((row) => row.territories.length)) {
      // Fill empty people with remaining territories
      const used = new Set(map.flatMap((row) => row.territories));
      const leftover = territoryHits.map((t) => t.id).filter((id) => !used.has(id));
      map.filter((row) => !row.territories.length).forEach((row, index) => {
        if (leftover[index]) row.territories.push(leftover[index]);
      });
      return { mode: "by_territory", territoryMap: map, confidence: "rule" };
    }
    return { mode: "by_territory", confidence: "rule" };
  }

  if (/\b(territor|region|north\s*west|south\s*east|scotland|wales)\b/i.test(lower)) {
    return { mode: "by_territory", confidence: "rule" };
  }

  return null;
}

export function summariseSplit(piles = [], callers = []) {
  const nameOf = (userId) =>
    (callers || []).find((c) => (c.user_id || c.userId) === userId)?.full_name
    || (callers || []).find((c) => (c.user_id || c.userId) === userId)?.name
    || "Caller";
  return (piles || []).map((pile) => ({
    userId: pile.userId,
    name: nameOf(pile.userId),
    count: (pile.accounts || []).length,
    buckets: pile.buckets || pile.territories || [],
  }));
}

export function toManualAssignments(piles = []) {
  const rows = [];
  for (const pile of piles || []) {
    for (const account of pile.accounts || []) {
      const companyId = account.company_id || account.id;
      if (!companyId || !pile.userId) continue;
      rows.push({ company_id: companyId, user_id: pile.userId });
    }
  }
  return rows;
}
