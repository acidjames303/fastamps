/**
 * Mailosaur OTP helper for FastAmps Connect QA registrations.
 * Read-only message search — does not log API keys or full email bodies.
 */
import { assertSafeMode } from './env-guard.mjs';

assertSafeMode('otp-mailosaur');

const apiKey = process.env.MAILOSAUR_API_KEY || process.env.CONNECT_QA_MAILOSAUR_API_KEY || '';
const serverId =
  process.env.MAILOSAUR_SERVER_ID || process.env.CONNECT_QA_MAILOSAUR_SERVER_ID || '';
const apiBase = (process.env.MAILOSAUR_API_BASE || 'https://mailosaur.com/api').replace(/\/$/, '');

export function mailosaurConfigured() {
  return Boolean(apiKey && serverId);
}

export function installerEmail(n) {
  const tag = `qa-launch-2026-installer${String(n).padStart(2, '0')}`;
  return `${tag}@${serverId}.mailosaur.net`;
}

function authHeader() {
  // Mailosaur uses HTTP Basic: apiKey as username, empty password
  const token = Buffer.from(`${apiKey}:`).toString('base64');
  return { Authorization: `Basic ${token}`, Accept: 'application/json' };
}

export async function waitForOtp({ email, timeoutMs = 120_000, pollMs = 3000 } = {}) {
  if (!mailosaurConfigured()) {
    return { ok: false, error: 'Mailosaur secrets not configured' };
  }
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
          const match = text.match(/\b(\d{4,8})\b/);
          if (match) {
            return {
              ok: true,
              email,
              otpLength: match[1].length,
              messageId: id,
              // Do not return OTP to stdout callers unless explicitly requested by register script
              otp: match[1],
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

export function describeMailosaurPlan() {
  return {
    ok: mailosaurConfigured(),
    serverIdSet: Boolean(serverId),
    apiKeySet: Boolean(apiKey),
    apiBase,
    aliasExamples: mailosaurConfigured()
      ? [installerEmail(1), installerEmail(2), installerEmail(20)]
      : ['qa-launch-2026-installer01@{SERVER_ID}.mailosaur.net'],
    accessModel: 'Mailosaur Messages API (read-only search/get); genuine Base44 OTP verify',
    reason: mailosaurConfigured()
      ? 'Ready to register installers and fetch OTPs'
      : 'Missing MAILOSAUR_API_KEY and/or MAILOSAUR_SERVER_ID',
  };
}

if (process.argv[1]?.endsWith('otp-mailosaur.mjs')) {
  console.log(JSON.stringify(describeMailosaurPlan(), null, 2));
  process.exit(mailosaurConfigured() ? 0 : 2);
}
