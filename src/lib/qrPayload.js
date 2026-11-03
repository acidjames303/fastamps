// Charger labels identify a unit; legacy stand QRs identify the demo journey.
// Never infer a real charger from a general website address.
const EMPTY = { token: '', serial: '', pin: '' };
const REGISTRATION_HOSTS = new Set([
  'connect.fastamps.com', 'fastamps-connect.base44.app',
  'fastamps-connect-v1.base44.app', // Host encoded in previously downloaded QRs.
]);

export function parseQrPayload(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return { ...EMPTY };

  const claimMatch = text.match(/\/claim\/([^/?#]+)/);
  if (claimMatch) return {
    ...EMPTY, token: decodeURIComponent(claimMatch[1]),
    demo: /[?&]demo=1(?:[&#]|$)/.test(text),
  };

  const isUrl = /^https?:\/\//i.test(text);
  let params = null;
  try {
    params = isUrl
      ? new URL(text).searchParams
      : new URLSearchParams(text.replace(/^[?&]/, ''));
  } catch {
    params = null;
  }
  const pick = (...keys) =>
    keys.map((key) => params?.get(key)).find((value) => value && value.trim())?.trim() || '';

  const token = pick('claim_token', 'token', 'd');
  const serial = pick('serial_number', 'serial', 's').toUpperCase();
  const pin = pick('pin_code', 'pin', 'p');

  if (token || serial) return { token, serial, pin, demo: params?.get('demo') === '1' };
  if (isUrl) {
    if (!params) return { ...EMPTY };
    const url = new URL(text);
    if (REGISTRATION_HOSTS.has(url.hostname) && url.pathname.replace(/\/$/, '') === '/register-install') {
      // These were printed before stand QRs carried an individual claim token.
      return { ...EMPTY, registration: true, tradeShow: params?.get('demo') === '1' };
    }
    return { ...EMPTY };
  }
  return { ...EMPTY, token: text };
}

export const parseClaimToken = (raw = '') => parseQrPayload(raw).token;