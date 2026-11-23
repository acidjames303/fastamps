import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Documents the known Giftbit Testbed GBP boundary used by admin-voucher-action.
 * Testbed virtual funds are USD/CAD only — GBP campaigns must not be treated as sent
 * and must not be resent.
 */

const PENDING_CODES = new Set([
  'INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED',
  'INFO_CAMPAIGN_CREATED_FUNDS_PENDING',
]);

function classifyGiftbitResponse({ mode, amount, infoCode, httpOk }) {
  const awaitingFunds =
    PENDING_CODES.has(infoCode) || String(infoCode || '').toUpperCase() === 'AWAITING_FUNDS';
  const testbedGbpMessage =
    mode === 'testbed' && Number(amount) > 0
      ? 'Giftbit Testbed is holding this GBP campaign because its virtual balance is only available in supported test currencies. This does not mean the live UK integration is unfunded.'
      : 'Giftbit accepted the campaign, but it is waiting for available account funds. Do not resend it.';

  if (awaitingFunds) {
    return {
      status: 'processing',
      provider_status: 'AWAITING_FUNDS',
      provider_error: testbedGbpMessage,
      voucher_delivered: false,
      do_not_resend: true,
      production_payout_proof: false,
    };
  }
  if (httpOk && String(infoCode || '').toUpperCase().includes('SENT')) {
    return {
      status: 'sent',
      voucher_delivered: true,
      do_not_resend: true,
      production_payout_proof: mode === 'live',
    };
  }
  return {
    status: 'failed',
    voucher_delivered: false,
    do_not_resend: true,
    production_payout_proof: false,
  };
}

test('Giftbit Testbed GBP campaign stops at awaiting-funds boundary', () => {
  const result = classifyGiftbitResponse({
    mode: 'testbed',
    amount: 30,
    infoCode: 'INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED',
    httpOk: true,
  });
  assert.equal(result.status, 'processing');
  assert.equal(result.provider_status, 'AWAITING_FUNDS');
  assert.equal(result.voucher_delivered, false);
  assert.equal(result.do_not_resend, true);
  assert.equal(result.production_payout_proof, false);
  assert.match(result.provider_error, /USD|CAD|test currencies|GBP/i);
});

test('demo or excluded claims are not wallet-eligible', () => {
  const claims = [
    { status: 'approved', reward_status: 'approved', is_demo: true, excluded_from_reporting: true, reward_amount: 10, serial_photo_url: 'https://x/a.png', install_photo_url: 'https://x/b.png' },
    { status: 'approved', reward_status: 'held', is_demo: true, excluded_from_reporting: true, reward_amount: 10, serial_photo_url: 'https://x/a.png', install_photo_url: 'https://x/b.png' },
  ];
  const active = claims.filter((c) => !c.excluded_from_reporting && !c.is_demo);
  const approved = active.filter(
    (c) => c.status === 'approved' && c.reward_status === 'approved' && c.serial_photo_url && c.install_photo_url,
  );
  assert.equal(active.length, 0);
  assert.equal(approved.reduce((s, c) => s + c.reward_amount, 0), 0);
});
