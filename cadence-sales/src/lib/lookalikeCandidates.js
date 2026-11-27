/** Merge a new discovery batch onto existing unadded candidates (domain/name dedupe). */
export function mergeLookalikeCandidates(existing = [], incoming = []) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const have = new Set(out.map((c) => String(c?.domain || c?.name || "").toLowerCase()).filter(Boolean));
  for (const row of incoming || []) {
    const key = String(row?.domain || row?.name || "").toLowerCase();
    if (!key || have.has(key)) continue;
    have.add(key);
    out.push(row);
  }
  return out;
}

export const LOOKALIKE_BATCH_SIZE = 100;
