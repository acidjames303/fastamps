import { secrets } from 'base44:runtime';

// AES-GCM encryption for handoff destination credentials (webhook tokens, CRM tokens).
// Uses the same master key as providerCredentials.ts — CREDENTIAL_ENCRYPTION_KEY.
const ENC_KEY_NAME = 'CREDENTIAL_ENCRYPTION_KEY';
const SALT = 'cadence-handoff-v1';

async function deriveKey() {
  const raw = (secrets.get(ENC_KEY_NAME) || '').trim();
  if (!raw) throw new Error('Credential encryption key not configured.');
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
  const [ivB64, dataB64] = (encrypted || '').split(':');
  if (!ivB64 || !dataB64) return {};
  const key = await deriveKey();
  const iv = fromB64(ivB64);
  const cipher = fromB64(dataB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function maskValue(v) {
  if (!v) return '';
  const s = String(v);
  if (s.length <= 4) return '••••';
  return '••••' + s.slice(-4);
}