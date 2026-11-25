// Shared helpers for Twilio browser (Voice SDK) calling.
//  - mintAccessToken: builds a Twilio access-token JWT (HS256) from the org's
//    API Key SID/Secret + Account SID + TwiML App SID. No external deps — uses
//    Web Crypto only, so it runs in the backend function runtime.
//  - signVoiceToken / verifyVoiceToken: a short-lived HMAC token the browser
//    forwards as a connect param, so the public TwiML webhook can authenticate
//    the request without user auth (Twilio's servers call that webhook).

// Trimmed Twilio browser-calling settings for an organisation. Credentials live
// in the encrypted ProviderCredential store, never on the Organisation record.
export async function loadTwilioVoiceConfig(base44, org) {
  const k = await getOrgCredentials(base44, org);
  return {
    accountSid: (k.get('TWILIO_ACCOUNT_SID') || '').trim(),
    authToken: (k.get('TWILIO_AUTH_TOKEN') || '').trim(),
    fromNumber: (k.get('TWILIO_FROM_NUMBER') || '').trim(),
    apiKeySid: (k.get('TWILIO_API_KEY_SID') || '').trim(),
    apiKeySecret: (k.get('TWILIO_API_KEY_SECRET') || '').trim(),
    twimlAppSid: (k.get('TWILIO_TWIML_APP_SID') || '').trim(),
  };
}

import { getOrgCredentials } from './providerCredentials.ts';

function b64urlStr(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBytes(s) {
  return new TextEncoder().encode(s);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', strToBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// Twilio access token (twilio-fpa;v=1). Identity + Voice grant for the TwiML App.
export async function mintAccessToken({ apiKeySid, apiKeySecret, accountSid, twimlAppSid, identity }) {
  const header = { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: apiKeySid + '-' + now,
    iss: apiKeySid,
    sub: accountSid,
    exp: now + 3600,
    grants: { identity, voice: { outgoing: { application_sid: twimlAppSid } } },
  };
  const data = b64urlStr(JSON.stringify(header)) + '.' + b64urlStr(JSON.stringify(payload));
  const key = await hmacKey(apiKeySecret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, strToBytes(data)));
  return data + '.' + b64urlBytes(sig);
}

// Short-lived signed token binding a call to an org. Verified by the TwiML
// webhook using that org's auth token — only the token-issuing function can
// mint a valid one, and it expires in 5 minutes.
export async function signVoiceToken(authToken, orgId) {
  const exp = Math.floor(Date.now() / 1000) + 900;
  const bodyStr = JSON.stringify({ o: orgId, e: exp });
  const key = await hmacKey(authToken);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, strToBytes(bodyStr)));
  return b64urlStr(bodyStr) + '.' + b64urlBytes(sig);
}

export async function verifyVoiceToken(authToken, token) {
  if (!authToken || !token) return null;
  const [bodyB64, sigB64] = token.split('.');
  if (!bodyB64 || !sigB64) return null;
  const bodyStr = atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/'));
  let body;
  try { body = JSON.parse(bodyStr); } catch { return null; }
  if (!body.o || !body.e) return null;
  if (body.e < Math.floor(Date.now() / 1000)) return null;
  const key = await hmacKey(authToken);
  const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, strToBytes(bodyStr));
  return ok ? body : null;
}