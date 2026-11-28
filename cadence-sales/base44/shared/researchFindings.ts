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
      return {
        label,
        value: clean(item?.value).slice(0, 900),
        source_url: sourceUrl,
        source_date: clean(item?.source_date).slice(0, 40),
        evidence: /customer.?confirm/i.test(label) ? 'customer_confirmed' : sourceUrl ? 'published' : 'unverified',
        confidence: Math.max(0, Math.min(100, Number(item?.confidence) || 0)),
      };
    })
    .filter((item) => item.label && item.value)
    .slice(0, maxItems);
}