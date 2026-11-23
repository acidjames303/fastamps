/**
 * Isolated Giftbit Testbed USD reward probe.
 * Does NOT touch UK Connect wallets, GBP amounts, or production voucher rows.
 *
 * Usage:
 *   CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *     node src/giftbit-usd-testbed-probe.mjs
 */
import { assertSafeMode } from './env-guard.mjs';
import { randomUUID } from 'node:crypto';

assertSafeMode('giftbit-usd-testbed-probe');

const mode = (process.env.GIFTBIT_MODE || 'testbed').toLowerCase();
if (mode === 'live') {
  console.log(JSON.stringify({ ok: false, error: 'Refusing live Giftbit' }, null, 2));
  process.exit(2);
}

const token = process.env.GIFTBIT_API_TOKEN || '';
const apiBase = (process.env.GIFTBIT_API_BASE_URL || 'https://api-testbed.giftbit.com/papi/v1').replace(
  /\/$/,
  '',
);
const priceCents = Number(process.env.GIFTBIT_USD_PRICE_CENTS || 1000);
const marketplaceGiftId = Number(process.env.GIFTBIT_USD_MARKETPLACE_GIFT_ID || 1);

const report = {
  ok: false,
  currency: 'USD',
  uk_production_unchanged: true,
  not_production_payout_proof: true,
  mode: 'testbed',
  stages: {},
};

if (!token) {
  report.error = 'GIFTBIT_API_TOKEN required';
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Accept-Encoding': 'identity',
};

async function giftbit(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, payload };
}

const funds = await giftbit('/funds');
report.stages.funds = {
  http: funds.status,
  usd_available: funds.payload?.fundsbycurrency?.USD?.available_in_cents,
  gbp_available: funds.payload?.fundsbycurrency?.GBP?.available_in_cents ?? 0,
};

const server =
  (process.env.MAILOSAUR_SMTP_USER || '').split('@')[0] ||
  (process.env.MAILOSAUR_SERVER_ID?.length <= 12 ? process.env.MAILOSAUR_SERVER_ID : '') ||
  '8deitqir';
const email = `qa-launch-2026-giftbit-usd@${server}.mailosaur.net`;
const orderId = `fastamps-qa-usd-${randomUUID()}`;

const create = await giftbit('/campaign', {
  method: 'POST',
  body: JSON.stringify({
    id: orderId,
    subject: 'FastAmps QA USD Testbed reward',
    message:
      'Isolated FastAmps Connect QA Testbed reward in USD. Not a UK production voucher. GBP wallets unchanged.',
    contacts: [{ firstname: 'QA', lastname: 'USDProbe', email }],
    marketplace_gifts: [{ id: marketplaceGiftId, price_in_cents: priceCents }],
  }),
});

report.stages.create = {
  http: create.status,
  info: create.payload?.info?.code,
  order_id: orderId,
  campaign_status: create.payload?.campaign?.status,
  currency_fee: create.payload?.campaign?.fees?.cost_entries?.[0]?.currency,
};

const dup = await giftbit('/campaign', {
  method: 'POST',
  body: JSON.stringify({
    id: orderId,
    subject: 'dup',
    message: 'dup',
    contacts: [{ firstname: 'QA', email }],
    marketplace_gifts: [{ id: marketplaceGiftId, price_in_cents: priceCents }],
  }),
});
report.stages.duplicate_rejected = {
  http: dup.status,
  code: dup.payload?.error?.code,
  ok: dup.status >= 400,
};

let gift = null;
for (let i = 0; i < 15; i++) {
  const list = await giftbit(`/gifts?campaign_id=${encodeURIComponent(orderId)}`);
  gift = list.payload?.gifts?.[0] || null;
  if (gift?.delivery_status === 'DELIVERED' || gift?.status === 'SENT_AND_REDEEMABLE') break;
  await new Promise((r) => setTimeout(r, 2000));
}

report.stages.gift = gift
  ? {
      delivery_status: gift.delivery_status,
      status: gift.status,
      brand_code: gift.brand_code,
      price_in_cents: gift.price_in_cents,
      recipient_email: gift.recipient_email,
    }
  : { found: false };

report.ok =
  create.ok &&
  report.stages.duplicate_rejected.ok &&
  gift?.delivery_status === 'DELIVERED' &&
  report.stages.create.currency_fee === 'USD';

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
