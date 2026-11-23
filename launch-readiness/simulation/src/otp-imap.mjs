/**
 * Read-only IMAP helper for a dedicated QA Gmail inbox (App Password).
 * Never logs message bodies or credentials. Used only to extract Base44 OTP codes.
 *
 * Requires: CONNECT_QA_GMAIL_ADDRESS, CONNECT_QA_GMAIL_APP_PASSWORD
 * Optional: CONNECT_QA_IMAP_HOST (default imap.gmail.com)
 */
import { assertSafeMode } from './env-guard.mjs';

assertSafeMode('otp-imap');

const address = process.env.CONNECT_QA_GMAIL_ADDRESS || '';
const appPassword = process.env.CONNECT_QA_GMAIL_APP_PASSWORD || '';
const host = process.env.CONNECT_QA_IMAP_HOST || 'imap.gmail.com';

export function mailboxConfigured() {
  return Boolean(address && appPassword && address.includes('@'));
}

export function plusAlias(n) {
  const [local, domain] = address.split('@');
  const tag = `qa-launch-2026-installer${String(n).padStart(2, '0')}`;
  return `${local}+${tag}@${domain}`;
}

/**
 * Placeholder contract — full IMAP client installs when mailbox secrets exist.
 * Returns { ok, reason } describing readiness without connecting yet.
 */
export function describeMailboxPlan() {
  return {
    ok: mailboxConfigured(),
    host,
    addressSet: Boolean(address),
    appPasswordSet: Boolean(appPassword),
    aliasExamples: mailboxConfigured()
      ? [plusAlias(1), plusAlias(2), plusAlias(20)]
      : ['<base>+qa-launch-2026-installer01@gmail.com'],
    accessModel: 'Gmail App Password over IMAP READ-ONLY; no personal password; no auth bypass',
    reason: mailboxConfigured()
      ? 'Ready to fetch OTPs after IMAP client wiring'
      : 'Missing CONNECT_QA_GMAIL_ADDRESS and/or CONNECT_QA_GMAIL_APP_PASSWORD',
  };
}

if (process.argv[1]?.endsWith('otp-imap.mjs')) {
  console.log(JSON.stringify(describeMailboxPlan(), null, 2));
  process.exit(mailboxConfigured() ? 0 : 2);
}
