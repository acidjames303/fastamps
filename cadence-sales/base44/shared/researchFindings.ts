// Shared helpers for the account-research functions: text clean-up, source-safe
// findings normalisation and deterministic keys for a given instruction or
// document.

export function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function safeUrl(value) {
  const text = clean(value);
  return /^https?:\/\//i.test(text) ? text : '';
}

// Deterministic key: re-running the same instruction or re-importing the same
// document refreshes its findings instead of creating duplicate records.
export function promptHash(input) {
  let hash = 0;
  const text = clean(input).toLowerCase();
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `${hash.toString(36)}-${text.length}`;
}

// Published evidence (a real source URL) stays separate from anything the
// customer confirmed, which stays separate from unverified notes.
export function normaliseFindings(raw, maxItems = 12) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => {
      const label = clean(item?.label).slice(0, 80);
      const sourceUrl = safeUrl(item?.source_url);
      const evidenceRaw = clean(item?.evidence);
      const evidence = ['published', 'customer_confirmed', 'unverified'].includes(evidenceRaw)
        ? evidenceRaw
        : /customer.?confirm/i.test(label) ? 'customer_confirmed' : sourceUrl ? 'published' : 'unverified';
      return {
        label,
        value: clean(item?.value).slice(0, 900),
        source_url: sourceUrl,
        source_date: clean(item?.source_date).slice(0, 40),
        evidence,
        confidence: Math.max(0, Math.min(100, Number(item?.confidence) || 0)),
      };
    })
    .filter((item) => item.label && item.value)
    .slice(0, maxItems);
}

function findingKey(item) {
  return `${clean(item?.label).toLowerCase()}::${clean(item?.value).toLowerCase().slice(0, 120)}`;
}

// Merge dig-deeper / manual findings into an existing pack without wiping
// customer-confirmed notes or duplicating the same label+value pair.
export function mergeFindings(existing, incoming, maxItems = 24) {
  const prior = normaliseFindings(existing, maxItems);
  const next = normaliseFindings(incoming, maxItems);
  const seen = new Set(prior.map(findingKey));
  const merged = [...prior];
  for (const item of next) {
    const key = findingKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  // Prefer customer-confirmed when two findings share a label but differ in value.
  const byLabel = new Map();
  for (const item of merged) {
    const labelKey = clean(item.label).toLowerCase();
    const prev = byLabel.get(labelKey);
    if (!prev) {
      byLabel.set(labelKey, item);
      continue;
    }
    if (prev.evidence === 'customer_confirmed' && item.evidence !== 'customer_confirmed') continue;
    if (item.evidence === 'customer_confirmed' && prev.evidence !== 'customer_confirmed') {
      byLabel.set(labelKey, item);
      continue;
    }
    if ((item.confidence || 0) >= (prev.confidence || 0)) byLabel.set(labelKey, item);
  }
  // Keep order: confirmed first, then published, then unverified.
  const rank = { customer_confirmed: 0, published: 1, unverified: 2 };
  return [...byLabel.values()]
    .sort((a, b) => (rank[a.evidence] ?? 9) - (rank[b.evidence] ?? 9))
    .slice(0, maxItems);
}