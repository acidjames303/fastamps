// TwiML safety — phone-number validation and XML escaping.
//
// Every value placed inside a TwiML document goes through escapeXml, and every
// destination is a plain dialable number. Raw request values are never
// interpolated: Twilio honours injected <Dial>/<Record>/<Redirect> verbs, which
// would let a caller spoof caller ID or bypass do-not-call suppression.

export function escapeXml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Returns a plain dialable number (digits with an optional leading +) or ''.
// Anything that is not a phone number — XML, letters, other punctuation — is
// rejected rather than cleaned.
export function normaliseDialNumber(value: any): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 32) return '';
  if (!/^\+?[\d\s\-().]+$/.test(raw)) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) return '';
  return digits;
}

// A Twilio call SID, safe to place in an API URL path.
export function isCallSid(value: any): boolean {
  return /^CA[0-9a-f]{32}$/i.test(String(value ?? '').trim());
}