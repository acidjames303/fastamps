// QR classifications:
//   A. Static website QR — opens the public Connect site only
//   B. Charger claim QR — /claim/{token}
//   C. Legacy serial/PIN QR — validated serial (+ optional PIN) payload
//   D. Invalid / unknown — clear error, no claim
const EMPTY = { token: '', serial: '', pin: '', kind: 'invalid' };
const REGISTRATION_HOSTS = new Set([
  'connect.fastamps.com',
  'connect-test.fastamps.com',
  'fastamps-connect.base44.app',
  'fastamps-connect-v1.base44.app', // Host encoded in previously downloaded QRs.
]);

function hostAllowed(hostname) {
  return REGISTRATION_HOSTS.has(hostname);
}

export function parseQrPayload(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return { ...EMPTY };

  const claimMatch = text.match(/\/claim\/([^/?#]+)/);
  if (claimMatch) {
    return {
      ...EMPTY,
      kind: 'claim',
      token: decodeURIComponent(claimMatch[1]),
    };
  }

  const isUrl = /^https?:\/\//i.test(text);
  let params = null;
  let url = null;
  try {
    if (isUrl) {
      url = new URL(text);
      params = url.searchParams;
    } else {
      params = new URLSearchParams(text.replace(/^[?&]/, ''));
    }
  } catch {
    params = null;
  }
  const pick = (...keys) =>
    keys.map((key) => params?.get(key)).find((value) => value && value.trim())?.trim() || '';

  const token = pick('claim_token', 'token', 'd');
  const serial = pick('serial_number', 'serial', 's').toUpperCase();
  const pin = pick('pin_code', 'pin', 'p');

  if (token) return { ...EMPTY, kind: 'claim', token, serial, pin };
  if (serial) return { ...EMPTY, kind: 'legacy', token: '', serial, pin };

  if (isUrl && url && hostAllowed(url.hostname)) {
    const path = url.pathname.replace(/\/$/, '') || '/';
    // Class A: static website / marketing QR — site home only.
    if (path === '/') {
      return { ...EMPTY, kind: 'website', website: true };
    }
    // Manual registration entry (not a charger claim, not trade-show auto-assign).
    if (path === '/register-install') {
      return { ...EMPTY, kind: 'registration', registration: true };
    }
    return { ...EMPTY, kind: 'invalid' };
  }

  if (isUrl) return { ...EMPTY, kind: 'invalid' };

  // Bare opaque token pasted without a full URL.
  return { ...EMPTY, kind: 'claim', token: text };
}

export const parseClaimToken = (raw = '') => parseQrPayload(raw).token;
