/**
 * Mailosaur OTP helper for FastAmps Connect QA registrations.
 * Read-only message search — does not log API keys or full email bodies.
 */
import { assertSafeMode } from './env-guard.mjs';

assertSafeMode('otp-mailosaur');

const apiKey =
  process.env.MAILOSAUR_API_KEY ||
  process.env.CONNECT_QA_MAILOSAUR_API_KEY ||
  process.env.MAILOSAUR_SMTP_PASSWORD ||
  '';
const configuredServerId =
  process.env.MAILOSAUR_SERVER_ID || process.env.CONNECT_QA_MAILOSAUR_SERVER_ID || '';
const smtpHost = process.env.MAILOSAUR_SMTP_HOST || '';
const smtpUser = process.env.MAILOSAUR_SMTP_USER || '';
const apiBase = (process.env.MAILOSAUR_API_BASE || 'https://mailosaur.com/api').replace(/\/$/, '');

let resolvedServerId = '';

function looksLikeServerId(value) {
  return /^[a-z0-9]{6,12}$/i.test(String(value || '').trim());
}

function authHeader() {
  // Mailosaur uses HTTP Basic: apiKey as username, empty password
  const token = Buffer.from(`${apiKey}:`).toString('base64');
  return { Authorization: `Basic ${token}`, Accept: 'application/json' };
}

/** Resolve server id from env, SMTP username local-part, or Mailosaur /servers list. */
export async function resolveServerId() {
  if (resolvedServerId) return resolvedServerId;
  if (looksLikeServerId(configuredServerId)) {
    resolvedServerId = configuredServerId.trim();
    return resolvedServerId;
  }
  // SMTP username is often {serverId}@{serverId}.mailosaur.net
  if (smtpUser.includes('@')) {
    const local = smtpUser.split('@')[0];
    if (looksLikeServerId(local)) {
      resolvedServerId = local;
      return resolvedServerId;
    }
  }
  if (!apiKey) throw new Error('Mailosaur API key missing');
  const res = await fetch(`${apiBase}/servers`, { headers: authHeader() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mailosaur /servers HTTP ${res.status}`);
  const items = data.items || [];
  if (!items.length) throw new Error('Mailosaur account has no servers');
  resolvedServerId = items[0].id;
  return resolvedServerId;
}

export function mailosaurConfigured() {
  return Boolean(apiKey);
}

export function installerEmail(n, serverId = resolvedServerId) {
  if (!serverId) throw new Error('resolveServerId() first');
  const tag = `qa-launch-2026-installer${String(n).padStart(2, '0')}`;
  return `${tag}@${serverId}.mailosaur.net`;
}

export async function waitForOtp({ email, timeoutMs = 120_000, pollMs = 3000 } = {}) {
  if (!mailosaurConfigured()) {
    return { ok: false, error: 'Mailosaur secrets not configured' };
  }
  const serverId = await resolveServerId();
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${apiBase}/messages/search?server=${encodeURIComponent(serverId)}`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentTo: email,
          subject: undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = `search_http_${res.status}`;
      } else {
        const items = data.items || data.messages || [];
        for (const item of items) {
          const id = item.id;
          if (!id) continue;
          const msgRes = await fetch(`${apiBase}/messages/${id}`, { headers: authHeader() });
          const msg = await msgRes.json().catch(() => ({}));
          const text = `${msg.subject || ''}\n${msg.text?.body || ''}\n${msg.html?.body || ''}`;
          // Prefer 6-digit Base44 verification codes; avoid short numbers (years, CSS, etc.).
          const six = [...text.matchAll(/\b(\d{6})\b/g)].map((m) => m[1]);
          const otp = six.find((c) => !['000000', '123456'].includes(c)) || null;
          if (otp) {
            return {
              ok: true,
              email,
              otpLength: otp.length,
              messageId: id,
              otp,
            };
          }
        }
        lastError = 'no_otp_yet';
      }
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return { ok: false, error: lastError || 'timeout', email };
}

export async function describeMailosaurPlan() {
  let serverId = null;
  let resolveError = null;
  try {
    serverId = mailosaurConfigured() ? await resolveServerId() : null;
  } catch (error) {
    resolveError = error.message;
  }
  return {
    ok: Boolean(mailosaurConfigured() && serverId),
    configuredServerIdLooksValid: looksLikeServerId(configuredServerId),
    resolvedServerIdSet: Boolean(serverId),
    apiKeySet: Boolean(apiKey),
    smtpHostSet: Boolean(smtpHost),
    smtpHostLooksLikePort: /^\d+$/.test(smtpHost),
    smtpUserSet: Boolean(smtpUser),
    apiBase,
    aliasExamples: serverId
      ? [installerEmail(1, serverId), installerEmail(2, serverId), installerEmail(20, serverId)]
      : ['qa-launch-2026-installer01@{SERVER_ID}.mailosaur.net'],
    accessModel:
      'Mailosaur Messages API (read-only search/get); SMTP secrets identify account; genuine Base44 OTP verify',
    reason: mailosaurConfigured() && serverId
      ? 'Ready to register installers and fetch OTPs'
      : resolveError || 'Missing Mailosaur API key / resolvable server id',
  };
}

if (process.argv[1]?.endsWith('otp-mailosaur.mjs')) {
  const plan = await describeMailosaurPlan();
  console.log(JSON.stringify(plan, null, 2));
  process.exit(plan.ok ? 0 : 2);
}
