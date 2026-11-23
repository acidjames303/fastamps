/**
 * Isolated Giftbit Testbed probe (NOT production payout proof).
 *
 * Giftbit Testbed virtual balance is USD/CAD only — GBP campaigns are expected
 * to stop at AWAITING_FUNDS / funds-required. Do not resend those campaigns.
 * Never uses live Giftbit. Never lifts QA is_demo / excluded_from_reporting.
 *
 * Env:
 *   GIFTBIT_API_TOKEN (required)
 *   GIFTBIT_TEMPLATE_ID (required)
 *   GIFTBIT_MODE must be testbed or unset (defaults testbed here)
 *   GIFTBIT_API_BASE_URL optional (default https://api-testbed.giftbit.com/papi/v1)
 *
 * Usage:
 *   CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *     node src/giftbit-testbed-probe.mjs
 */
import { assertSafeMode } from './env-guard.mjs';
import { randomUUID } from 'node:crypto';

assertSafeMode('giftbit-testbed-probe');

const mode = (process.env.GIFTBIT_MODE || 'testbed').toLowerCase();
if (mode === 'live') {
  console.log(JSON.stringify({ ok: false, error: 'Refusing live Giftbit from QA probe' }, null, 2));
  process.exit(2);
}

const token = process.env.GIFTBIT_API_TOKEN || '';
const templateId = process.env.GIFTBIT_TEMPLATE_ID || '';
const apiBase = (process.env.GIFTBIT_API_BASE_URL || 'https://api-testbed.giftbit.com/papi/v1').replace(
  /\/$/,
  '',
);

const report = {
  ok: false,
  mode: 'testbed',
  apiBase,
  configured: Boolean(token && templateId),
  currency_note:
    'Giftbit Testbed funds are USD/CAD only. GBP campaigns are expected not to deliver vouchers to recipients; record provider response and stop (no resend).',
  stages: {},
};

if (!token || !templateId) {
  report.error = 'GIFTBIT_API_TOKEN and GIFTBIT_TEMPLATE_ID required for Testbed probe';
  report.stage_reached = 'not_configured';
  console.log(JSON.stringify(report, null, 2));
  process.exit(0); // not a harness failure — secrets pending
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept-Encoding': 'identity',
  Accept: 'application/json',
};

async function giftbit(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, payload };
}

// 1) Ping / funds diagnostic (read-only where possible)
const ping = await giftbit('/ping').catch((e) => ({ status: 0, ok: false, payload: { error: String(e) } }));
report.stages.ping = { http: ping.status, ok: ping.ok, keys: Object.keys(ping.payload || {}) };

const funds = await giftbit('/funds').catch((e) => ({ status: 0, ok: false, payload: { error: String(e) } }));
report.stages.funds = {
  http: funds.status,
  ok: funds.ok,
  // Do not log full fund balances with account identifiers beyond currency summary
  summary: summariseFunds(funds.payload),
};

function summariseFunds(payload) {
  try {
    const list = payload?.funds || payload?.balances || payload?.data || [];
    if (Array.isArray(list)) {
      return list.map((row) => ({
        currency: row.currency || row.currency_code || row.code,
        // omit exact amounts in logs if huge objects; keep presence only
        has_balance_field: row.balance !== undefined || row.available !== undefined,
      }));
    }
    if (payload?.currency) return [{ currency: payload.currency, has_balance_field: true }];
    return { type: typeof payload, keys: Object.keys(payload || {}) };
  } catch {
    return { unparseable: true };
  }
}

// 2) Create a single GBP £30 Testbed campaign — expect funds-required, not delivery
const orderId = `fastamps-qa-testbed-${randomUUID()}`;
const contactEmail =
  process.env.CONNECT_QA_GIFTBIT_PROBE_EMAIL ||
  `qa-launch-2026-giftbit-probe@${(process.env.MAILOSAUR_SMTP_USER || '8deitqir@x').split('@')[0] || '8deitqir'}.mailosaur.net`;

const create = await giftbit('/campaign', {
  method: 'POST',
  body: JSON.stringify({
    gift_template: templateId,
    contacts: [{ firstname: 'QA', lastname: 'Probe', email: contactEmail }],
    price_in_cents: 3000, // £30 — Testbed cannot fund GBP
    id: orderId,
  }),
});

const infoCode = create.payload?.info?.code || create.payload?.campaign?.status || create.payload?.code;
const awaitingFunds = [
  'INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED',
  'INFO_CAMPAIGN_CREATED_FUNDS_PENDING',
  'AWAITING_FUNDS',
].includes(String(infoCode || '').toUpperCase()) || String(infoCode || '').toUpperCase().includes('FUND');

report.stages.campaign_create = {
  http: create.status,
  ok: create.ok,
  order_id: orderId,
  provider_code: infoCode,
  message: create.payload?.info?.message || create.payload?.error?.message || create.payload?.message,
  awaiting_funds: awaitingFunds,
  // Never treat as sent/delivered for GBP Testbed
  voucher_delivered: false,
};

report.stage_reached = !create.ok && !awaitingFunds
  ? 'campaign_create_error'
  : awaitingFunds
    ? 'gbp_awaiting_funds_boundary'
    : create.ok
      ? 'campaign_accepted_check_status'
      : 'campaign_create_failed';

report.do_not_resend = awaitingFunds || report.stage_reached === 'gbp_awaiting_funds_boundary';
report.ok =
  report.configured &&
  (awaitingFunds || report.stage_reached === 'gbp_awaiting_funds_boundary' || report.stages.ping.ok);
report.not_production_payout_proof = true;

console.log(JSON.stringify(report, null, 2));
// Exit 0 when we correctly hit the known GBP Testbed boundary
process.exit(report.ok || report.do_not_resend ? 0 : 1);
