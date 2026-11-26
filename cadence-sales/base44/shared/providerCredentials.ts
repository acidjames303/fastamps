import { secrets } from 'base44:runtime';

// Server-side credential management. Organisation provider credentials are
// encrypted with AES-GCM (Web Crypto) using a master key from Base44 secrets.
// Decrypted values NEVER leave the backend — the frontend receives only
// booleans and masked identifiers (last 4 chars).

const ENC_KEY_NAME = 'CREDENTIAL_ENCRYPTION_KEY';
const SALT = 'cadence-credential-v1';

// All provider field names that should be stored encrypted.
export const ALL_SECRET_FIELDS = [
  'LUSHA_API_KEY', 'FULLENRICH_API_KEY', 'APOLLO_API_KEY', 'ROCKETREACH_API_KEY',
  'YAY_RESELLER', 'YAY_USER', 'YAY_PASSWORD', 'YAY_SIP_USER_UUID',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER',
  'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID',
  'PRODATA_API_TOKEN',
];

// Maps provider id → the credential fields it owns.
export const PROVIDER_FIELDS = {
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID'],
  lusha: ['LUSHA_API_KEY'],
  fullenrich: ['FULLENRICH_API_KEY'],
  apollo: ['APOLLO_API_KEY'],
  rocketreach: ['ROCKETREACH_API_KEY'],
  yay: ['YAY_RESELLER', 'YAY_USER', 'YAY_PASSWORD', 'YAY_SIP_USER_UUID'],
  prodata: ['PRODATA_API_TOKEN'],
  gmail: ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET'],
  outlook: ['OUTLOOK_OAUTH_CLIENT_ID', 'OUTLOOK_OAUTH_CLIENT_SECRET'],
};

// TWILIO_FROM_NUMBER is a caller ID, not a secret — safe to expose for display.
export const NON_SECRET_DISPLAY_FIELDS = ['TWILIO_FROM_NUMBER'];

// --- AES-GCM crypto helpers ---

async function deriveKey() {
  const raw = (secrets.get(ENC_KEY_NAME) || '').trim();
  if (!raw) throw new Error('Credential encryption key not configured. Set CREDENTIAL_ENCRYPTION_KEY in app secrets.');
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(raw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toB64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function fromB64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }

export async function encryptJSON(obj) {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return toB64(iv) + ':' + toB64(cipher);
}

export async function decryptJSON(encrypted) {
  const [ivB64, dataB64] = encrypted.split(':');
  if (!ivB64 || !dataB64) return {};
  const key = await deriveKey();
  const iv = fromB64(ivB64);
  const cipher = fromB64(dataB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

function maskValue(v) {
  if (!v) return '';
  const s = String(v);
  if (s.length <= 4) return '••••';
  return '••••' + s.slice(-4);
}

function buildMasked(creds, fields) {
  const m = {};
  for (const f of fields) if (creds[f]) m[f] = maskValue(creds[f]);
  return m;
}

function buildConnected(creds, fields) {
  const c = {};
  for (const f of fields) c[f] = !!creds[f];
  return c;
}

async function logCredentialAudit(base44, org, userId, provider) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: org.id,
      actor_user_id: userId || '',
      action: 'credential_updated',
      entity_type: 'ProviderCredential',
      entity_id: provider,
      new_value: provider,
      timestamp: new Date().toISOString(),
    });
  } catch {}
}

// --- Public API ---

// Loads all encrypted credentials for an organisation and returns a secrets-like
// { get(name) } wrapper. ONLY org-level credentials are returned — there is no
// app-level fallback, so one organisation can never read or use another's keys
// (tenant isolation). Use seedPlatformOrgCredentials to copy app-level secrets
// into an org's own ProviderCredential records where that is intended.
export async function getOrgCredentials(base44, org) {
  const records = await base44.asServiceRole.entities.ProviderCredential.filter(
    { organisation_id: org.id }, '-updated_date', 50,
  ).catch(() => []);

  const orgCreds = {};
  for (const rec of records || []) {
    if (!rec.encrypted_data) continue;
    try { Object.assign(orgCreds, await decryptJSON(rec.encrypted_data)); } catch {}
  }

  return {
    get: (name) => orgCreds[name] || '',
    raw: orgCreds,
  };
}

// Encrypts and upserts credentials for a single provider. Only fields present in
// `keys` are touched — an empty string clears that field. Returns booleans only.
export async function saveOrgCredentials(base44, org, userId, provider, keys) {
  const fields = PROVIDER_FIELDS[provider] || [];
  if (!fields.length) throw new Error(`Unknown provider: ${provider}`);

  const existing = await base44.asServiceRole.entities.ProviderCredential.filter(
    { organisation_id: org.id, provider }, '-updated_date', 1,
  ).catch(() => []);

  let merged = {};
  if (existing && existing[0] && existing[0].encrypted_data) {
    try { merged = await decryptJSON(existing[0].encrypted_data); } catch {}
  }

  for (const field of fields) {
    if (keys[field] !== undefined) {
      const v = (keys[field] || '').trim();
      if (v) merged[field] = v; else delete merged[field];
    }
  }

  const now = new Date().toISOString();
  const encrypted = await encryptJSON(merged);

  if (existing && existing[0]) {
    await base44.asServiceRole.entities.ProviderCredential.update(existing[0].id, {
      encrypted_data: encrypted,
      masked_identifiers: buildMasked(merged, fields),
      field_names: Object.keys(merged),
      created_by_user_id: userId,
      updated_at: now,
    });
  } else {
    await base44.asServiceRole.entities.ProviderCredential.create({
      organisation_id: org.id,
      provider,
      encrypted_data: encrypted,
      masked_identifiers: buildMasked(merged, fields),
      field_names: Object.keys(merged),
      created_by_user_id: userId,
      updated_at: now,
    });
  }

  // Defensive regression guard: ensure no plaintext secret values linger in
  // Organisation.settings.api_keys. The encrypted ProviderCredential is the
  // only credential store; stripping here guarantees that saving (or testing)
  // a connection can never leave plaintext credentials on the Organisation.
  await stripPlaintextCredentials(base44, org.id);

  await logCredentialAudit(base44, org, userId, provider);
  return { connected: buildConnected(merged, fields) };
}

// Removes any ALL_SECRET_FIELDS values from an organisation's settings.api_keys.
// If api_keys holds only secret fields, it is deleted entirely; non-secret keys
// (none currently, but reserved) are preserved. Idempotent and no-op if clean.
export async function stripPlaintextCredentials(base44, orgId) {
  const org = await base44.asServiceRole.entities.Organisation.get(orgId).catch(() => null);
  if (!org || !org.settings || !org.settings.api_keys) return;
  const settings = { ...org.settings };
  const cleaned = { ...settings.api_keys };
  for (const f of ALL_SECRET_FIELDS) delete cleaned[f];
  if (Object.keys(cleaned).length > 0) settings.api_keys = cleaned;
  else delete settings.api_keys;
  await base44.asServiceRole.entities.Organisation.update(orgId, { settings });
}

// Returns connection status for all providers — booleans + masked identifiers only.
// Only org-level credentials are considered (no app-level fallback), so each
// organisation sees only its own connections — preserving tenant isolation.
export async function getConnectionStatus(base44, org) {
  const records = await base44.asServiceRole.entities.ProviderCredential.filter(
    { organisation_id: org.id }, '-updated_date', 50,
  ).catch(() => []);

  const orgCreds = {};
  for (const rec of records || []) {
    if (!rec.encrypted_data) continue;
    try { Object.assign(orgCreds, await decryptJSON(rec.encrypted_data)); } catch {}
  }

  const connected = {};
  const masked = {};
  for (const field of ALL_SECRET_FIELDS) {
    connected[field] = !!orgCreds[field];
    if (orgCreds[field]) masked[field] = maskValue(orgCreds[field]);
  }

  const twilioFromNumber = orgCreds.TWILIO_FROM_NUMBER || '';
  const browserVoice = !!(connected.TWILIO_API_KEY_SID && connected.TWILIO_API_KEY_SECRET && connected.TWILIO_TWIML_APP_SID && connected.TWILIO_ACCOUNT_SID);

  return { connected, twilioFromNumber, browserVoice, masked };
}