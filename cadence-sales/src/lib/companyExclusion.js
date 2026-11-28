// Company exclusion lists (current clients / do-not-prospect) keep discovery
// and imports from resurfacing accounts Zenitech already works with.

export function normaliseCompanyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|the|group|holdings|uk|co)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

export function parseExcludedCompanyLines(text = "") {
  const seen = new Set();
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const name = line.trim();
    if (!name) continue;
    const key = normaliseCompanyName(name) || name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// Single-column Excel/CSV of client names, or a sheet whose first column is names
// (header row may be a sector label rather than "Company").
export function parseExcludedCompaniesFromSheet(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const names = [];
  for (const raw of rows) {
    if (Array.isArray(raw)) {
      const value = String(raw[0] ?? "").trim();
      if (value) names.push(value);
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const values = Object.values(raw).map((v) => String(v ?? "").trim()).filter(Boolean);
    if (!values.length) continue;
    // Prefer an explicit company-ish key; otherwise take the first cell.
    const entries = Object.entries(raw);
    const companyEntry = entries.find(([key, value]) => {
      const k = String(key || "").toLowerCase();
      return value && (/company|account|client|prospect|name/.test(k) || k.length > 40);
    });
    names.push(String(companyEntry?.[1] || values[0]).trim());
  }
  // Drop a header-like first row when it looks like sector labels, not a firm.
  const cleaned = names.filter((name, index) => {
    if (index === 0 && /gaming|banking|finance|energy|insurance|,/.test(name) && !/\bltd\b|\blimited\b|\bplc\b/i.test(name)) {
      return false;
    }
    return Boolean(name);
  });
  return parseExcludedCompanyLines(cleaned.join("\n"));
}

export function isCompanyExcluded(name, excluded = []) {
  const target = normaliseCompanyName(name);
  if (!target) return false;
  const list = (excluded || []).map(normaliseCompanyName).filter(Boolean);
  if (!list.length) return false;
  return list.some((ex) => ex === target || (ex.length >= 4 && (target.includes(ex) || ex.includes(target))));
}

export function filterExcludedCompanies(companies = [], excluded = []) {
  const kept = [];
  const blocked = [];
  for (const company of companies || []) {
    const name = company?.company_name || company?.name || "";
    if (isCompanyExcluded(name, excluded)) blocked.push(company);
    else kept.push(company);
  }
  return { kept, blocked };
}

// Pull dominant industries from an imported pilot list to seed lookalike ICP.
export function industriesFromAccounts(accounts = [], { limit = 8 } = {}) {
  const counts = new Map();
  for (const account of accounts || []) {
    const industry = String(account.industry || "").trim();
    if (!industry) continue;
    // Primary Industry may arrive as "Finance" or "Finance > Banking".
    for (const part of industry.split(/[>|/•]/).map((p) => p.trim()).filter(Boolean)) {
      counts.set(part, (counts.get(part) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/** Merge industry hints into ICP target_sectors (case-insensitive dedupe, existing first). */
export function mergeTargetSectors(existing = [], industryHints = []) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const name = String(raw || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  for (const item of existing || []) push(item);
  for (const hint of industryHints || []) push(hint?.name ?? hint);
  return out;
}

/** Parse ProspectList.icp into a structured object; free-text becomes a stub object. */
export function parseListIcp(raw) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ...parsed };
  } catch {
    /* free-text */
  }
  const text = String(raw || "").trim();
  return text ? { legacy_free_text: text } : {};
}
