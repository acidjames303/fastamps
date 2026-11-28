/** Digits-only key for comparing phone values across fields. */
export function phoneDigitKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

/**
 * Distinct phone values already visible on a prospect + its contacts
 * (import mobile, Lusha extra, direct, company phone/landline).
 * Used to decide whether ContactPhone candidates should stay expanded.
 */
export function distinctPhoneSignals(prospect = {}) {
  const seen = new Set();
  const add = (raw) => {
    const key = phoneDigitKey(raw);
    if (key) seen.add(key);
  };
  add(prospect.phone);
  add(prospect.landline);
  for (const contact of Array.isArray(prospect.contacts) ? prospect.contacts : []) {
    add(contact?.mobile);
    add(contact?.phone);
    add(contact?.lusha_mobile);
    add(contact?.direct_dial);
  }
  return seen;
}

/** True when the caller should see every held number without an extra click. */
export function shouldExpandPhoneCandidates(prospect) {
  return distinctPhoneSignals(prospect).size >= 2;
}
