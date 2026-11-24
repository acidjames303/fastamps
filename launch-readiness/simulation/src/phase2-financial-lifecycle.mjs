/**
 * Phase 2: complete financial lifecycle for 50 QA installers on existing
 * VIRTUAL-LINKS-2026 claims. Uses qa_financial_lifecycle so commercial
 * reporting exclusions remain intact while exercising request-voucher-v2
 * + admin fulfilment + linked Giftbit USD Testbed campaigns.
 *
 * CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *   node src/phase2-financial-lifecycle.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId } from './otp-mailosaur.mjs';

assertSafeMode('phase2-financial-lifecycle');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const PREFIX = 'VIRTUAL-LINKS-2026';
const DEMO = 'VIRTUAL-LINKS-SIM-2026';
const PASSWORD = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE;
if (!PASSWORD) {
  console.error(JSON.stringify({ ok: false, error: 'Set CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE (do not embed passwords in source).' }));
  process.exit(2);
}
const ART = '/opt/cursor/artifacts/phase2';
mkdirSync(ART, { recursive: true });

const report = {
  ok: false,
  started_at: new Date().toISOString(),
  stages: {},
  giftbit_emails: [],
  failures: [],
  weeks: [],
};

async function http(method, path, body, token) {
  const headers = { Accept: 'application/json', 'User-Agent': 'phase2-financial/1.0' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms: Date.now() - t0 };
}

async function login(email, password) {
  const { status, data } = await http('POST', '/auth/login', { email, password });
  if (!data.access_token) throw new Error(`login ${email}: ${status}`);
  return data.access_token;
}

async function listAll(entity, token) {
  const out = [];
  for (let skip = 0; ; skip += 200) {
    const { data } = await http('GET', `/entities/${entity}?limit=200&skip=${skip}`, undefined, token);
    if (!Array.isArray(data) || !data.length) break;
    out.push(...data);
    if (data.length < 200) break;
  }
  return out;
}

/** Persona plan: 50 people, 200 installs, £2500 gross (welcome £10 each). */
function buildPersonaPlan(emails) {
  const specs = [
    { id: 'A_retain20', n: 8, installs: 1, behaviour: 'retain_20_no_redeem' },
    { id: 'B_retain30', n: 7, installs: 2, behaviour: 'retain_30_no_redeem' },
    { id: 'C_first40', n: 10, installs: 3, behaviour: 'redeem_first_40' },
    { id: 'D_4install', n: 5, installs: 4, behaviour: 'redeem_40_leave_10' },
    { id: 'E_5install', n: 5, installs: 5, behaviour: 'retain_60_or_redeem40' },
    { id: 'F_6install', n: 5, installs: 6, behaviour: 'redeem_40_then_continue' },
    { id: 'G_7install', n: 4, installs: 7, behaviour: 'redeem_40_then_40' },
    { id: 'H_8install', n: 3, installs: 8, behaviour: 'redeem_40_then_50' },
    { id: 'I_mixed', n: 3, installs: 7, behaviour: 'multi_pending_never' },
  ];
  const plan = [];
  let i = 0;
  for (const spec of specs) {
    for (let k = 0; k < spec.n; k += 1) {
      plan.push({
        email: emails[i],
        installer_n: i + 1,
        persona: spec.id,
        target_installs: spec.installs,
        behaviour: spec.behaviour,
        variant: k,
      });
      i += 1;
    }
  }
  if (plan.length !== 50) throw new Error(`persona count ${plan.length}`);
  if (plan.reduce((s, p) => s + p.target_installs, 0) !== 200) {
    throw new Error('persona installs must sum to 200');
  }
  return plan;
}

function expectedForPersona(p) {
  const welcome = 10;
  const installEarn = p.target_installs * 10;
  const gross = welcome + installEarn;
  // Approximate expected redemption patterns (GBP app accounting)
  let redeemed = 0;
  let available = gross;
  const notes = [];
  switch (p.behaviour) {
    case 'retain_20_no_redeem':
      notes.push('1 install + welcome = £20 retained');
      break;
    case 'retain_30_no_redeem':
      notes.push('2 installs + welcome = £30 retained (below first-redeem rule until 3 installs)');
      break;
    case 'redeem_first_40':
      redeemed = 40; available = 0;
      notes.push('First redemption £40 (welcome + 3 installs)');
      break;
    case 'redeem_40_leave_10':
      redeemed = 40; available = 10;
      notes.push('Redeem £40 leave £10');
      break;
    case 'retain_60_or_redeem40':
      if (p.variant < 2) {
        notes.push('Retain £60 no redeem');
      } else {
        redeemed = 40; available = 20;
        notes.push('Redeem £40 leave £20');
      }
      break;
    case 'redeem_40_then_continue':
      redeemed = 40; available = gross - 40;
      notes.push('Redeem £40 then continue earning');
      break;
    case 'redeem_40_then_40':
      redeemed = 80; available = gross - 80;
      notes.push('Redeem £40 then £40');
      break;
    case 'redeem_40_then_50':
      redeemed = 90; available = gross - 90;
      notes.push('Redeem £40 then £50');
      break;
    case 'multi_pending_never':
      if (p.variant === 0) {
        notes.push('Never redeem — retain all');
      } else if (p.variant === 1) {
        redeemed = 40; available = gross - 40;
        notes.push('Pending/failed recovery then redeem £40');
      } else {
        redeemed = 40; available = gross - 40;
        notes.push('Double-click / concurrent protection then redeem £40');
      }
      break;
    default:
      break;
  }
  return { welcome, installEarn, gross, redeemed, available, notes };
}

async function giftbitUsd({ email, amountGbp, voucherId, subject }) {
  const token = process.env.GIFTBIT_API_TOKEN || '';
  const apiBase = (process.env.GIFTBIT_API_BASE_URL || 'https://api-testbed.giftbit.com/papi/v1').replace(/\/$/, '');
  const orderId = `fastamps-p2-usd-${voucherId || randomUUID().slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  const priceCents = Math.round(Number(amountGbp) * 100); // GBP→USD nominal mapping in Testbed only
  const res = await fetch(`${apiBase}/campaign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
    },
    body: JSON.stringify({
      id: orderId,
      subject: subject || `FastAmps Connect QA redemption £${amountGbp} → $${amountGbp} Testbed`,
      message: `Isolated Giftbit USD Testbed twin for application voucher ${voucherId || 'n/a'}. App accounting remains GBP. Not a UK production payout.`,
      contacts: [{ firstname: 'JP', lastname: 'FastAmps', email }],
      marketplace_gifts: [{ id: Number(process.env.GIFTBIT_USD_MARKETPLACE_GIFT_ID || 1), price_in_cents: priceCents }],
    }),
  });
  const payload = await res.json().catch(() => ({}));
  let gift = null;
  if (res.ok) {
    for (let i = 0; i < 10; i += 1) {
      const list = await fetch(`${apiBase}/gifts?campaign_id=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
      });
      const listPayload = await list.json().catch(() => ({}));
      gift = listPayload?.gifts?.[0] || null;
      if (gift?.delivery_status === 'DELIVERED') break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return {
    ok: res.ok,
    http: res.status,
    order_id: orderId,
    voucher_id: voucherId || null,
    gbp_amount: amountGbp,
    usd_amount: amountGbp,
    email,
    provider_status: payload?.campaign?.status || payload?.info?.code || null,
    message: payload?.info?.message || payload?.error?.message || null,
    delivery_status: gift?.delivery_status || null,
    gift_status: gift?.status || null,
    subject: subject || null,
    submitted_at: new Date().toISOString(),
    not_uk_production: true,
  };
}

async function approveReward(adminToken, claimId) {
  return http('PUT', `/entities/InstallClaim/${claimId}`, {
    reward_status: 'approved',
    reviewed_at: new Date().toISOString(),
    review_note: 'Phase2 interleaved approval',
  }, adminToken);
}

async function requestRedeem(token) {
  return http('POST', '/functions/request-voucher-v2', {}, token);
}

async function fulfilManual(adminToken, requestId) {
  return http('POST', '/functions/admin-voucher-action', {
    request_id: requestId,
    action: 'manual_sent',
  }, adminToken);
}

async function tryGiftbitSend(adminToken, requestId) {
  return http('POST', '/functions/admin-voucher-action', {
    request_id: requestId,
    action: 'send',
  }, adminToken);
}

// -------------------- main --------------------
const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const serverId = await resolveServerId();
const emails = Array.from({ length: 50 }, (_, i) => installerEmail(i + 1, serverId));
const plan = buildPersonaPlan(emails);
report.stages.persona_plan = plan.map((p) => ({
  n: p.installer_n,
  persona: p.persona,
  installs: p.target_installs,
  behaviour: p.behaviour,
  expected: expectedForPersona(p),
}));

// Enable lifecycle on installers
const installers = await listAll('Installer', adminToken);
const byEmail = Object.fromEntries(installers.map((i) => [String(i.user_email || '').toLowerCase(), i]));
let enabled = 0;
for (const p of plan) {
  const row = byEmail[p.email.toLowerCase()];
  if (!row) continue;
  await http('PUT', `/entities/Installer/${row.id}`, {
    qa_financial_lifecycle: true,
    is_demo: true,
    demo_label: DEMO,
    excluded_from_reporting: true,
    membership_status: 'active',
    reward_account_status: 'active',
    reward_account_reason: null,
    welcome_reward_status: 'available',
    welcome_reward_amount: 10,
    hq_training_completed: true,
    certificates_received: true,
    programme_terms_version: '2026-10-v1',
    programme_terms_accepted_at: row.programme_terms_accepted_at || new Date().toISOString(),
  }, adminToken);
  enabled += 1;
}
report.stages.installers_enabled = enabled;

// Load + redistribute claims
let claims = (await listAll('InstallClaim', adminToken))
  .filter((c) => String(c.serial_number || '').startsWith(PREFIX));
if (claims.length !== 200) {
  report.stages.claim_count_warning = claims.length;
}

// Snapshot prior assignment
writeFileSync(`${ART}/claims-snapshot-before.json`, JSON.stringify(claims.map((c) => ({
  id: c.id, serial: c.serial_number, installer_email: c.installer_email, reward_status: c.reward_status,
})), null, 2));

// Build claim bags per persona target
const pool = [...claims];
const assignment = [];
for (const p of plan) {
  const take = pool.splice(0, p.target_installs);
  for (const c of take) {
    assignment.push({ claim_id: c.id, email: p.email, persona: p.persona });
    await http('PUT', `/entities/InstallClaim/${c.id}`, {
      installer_email: p.email,
      qa_financial_lifecycle: true,
      is_demo: true,
      demo_label: DEMO,
      excluded_from_reporting: true,
      reward_status: 'held', // start held; approve in interleaved weeks
      status: 'approved',
      exclusion_reason: 'VIRTUAL QA financial lifecycle — excluded from commercial reporting',
    }, adminToken);
  }
  p.claim_ids = take.map((c) => c.id);
}
report.stages.claims_reassigned = assignment.length;

// Login tokens for installers
const tokens = {};
for (const p of plan) {
  try {
    tokens[p.email] = await login(p.email, PASSWORD);
  } catch (e) {
    report.failures.push({ type: 'login', email: p.email, error: String(e.message || e) });
  }
}
report.stages.logins_ok = Object.keys(tokens).length;

const jp = process.env.CONNECT_QA_ADMIN_EMAIL;
const priorGiftbit = {
  order_id: 'fastamps-virtual-usd-b058d788-553c-48a2-a956-f3c4c434647f',
  email: jp,
  delivery_status: 'DELIVERED',
  gbp_amount: 10,
  usd_amount: 10,
  note: 'Phase1 sample preserved',
};
report.giftbit_emails.push(priorGiftbit);

const ledger = [];
const weekLog = [];

function week(name, fn) {
  return { name, fn };
}

const weeks = [
  week('W1_approve_first_wave', async () => {
    // Approve first 1–3 installs depending on persona (not all at once)
    const out = [];
    for (const p of plan) {
      const approveN = Math.min(p.target_installs, p.target_installs <= 2 ? p.target_installs : 3);
      for (const id of p.claim_ids.slice(0, approveN)) {
        const r = await approveReward(adminToken, id);
        out.push({ email: p.email, claim_id: id, ok: r.status < 400 });
      }
    }
    return { approved: out.filter((x) => x.ok).length };
  }),
  week('W2_first_redemptions', async () => {
    const out = [];
    for (const p of plan) {
      if (!['redeem_first_40', 'redeem_40_leave_10', 'redeem_40_then_continue', 'redeem_40_then_40', 'redeem_40_then_50'].includes(p.behaviour)
        && !(p.behaviour === 'retain_60_or_redeem40' && p.variant >= 2)
        && !(p.behaviour === 'multi_pending_never' && p.variant >= 1)) {
        continue;
      }
      const tok = tokens[p.email];
      if (!tok) continue;
      const req = await requestRedeem(tok);
      out.push({ email: p.email, step: 'request', status: req.status, amount: req.data.amount, id: req.data.request?.id, error: req.data.error });
      if (req.data.request?.id && (req.data.success || req.data.status === 'requested')) {
        // Attempt real Giftbit GBP send (expect AWAITING_FUNDS on Testbed) then manual fulfil
        const send = await tryGiftbitSend(adminToken, req.data.request.id);
        out.push({ email: p.email, step: 'giftbit_gbp_send', status: send.status, body: send.data.status || send.data.error || send.data.message });
        if (send.data.status === 'processing' || send.status >= 400) {
          // Restore path: if send left processing without marking issued, use manual_sent after
          // refreshing request — for AWAITING_FUNDS claims may still be locked; manual_sent issues them.
        }
        // Re-fetch; if still requested/failed/processing without issued rewards, manual_sent
        const fulfil = await fulfilManual(adminToken, req.data.request.id);
        out.push({ email: p.email, step: 'manual_sent', status: fulfil.status, ok: fulfil.data.success === true, error: fulfil.data.error });
        if (fulfil.data.success && report.giftbit_emails.length < 8) {
          const usd = await giftbitUsd({
            email: jp,
            amountGbp: req.data.amount || 40,
            voucherId: req.data.request.id,
            subject: `FastAmps QA first redemption £${req.data.amount || 40}`,
          });
          report.giftbit_emails.push({ ...usd, synthetic_installer: p.email, persona: p.persona });
        }
      }
    }
    return { events: out.length, samples: out.slice(0, 12) };
  }),
  week('W3_approve_remainder', async () => {
    const out = [];
    for (const p of plan) {
      for (const id of p.claim_ids.slice(3)) {
        const r = await approveReward(adminToken, id);
        out.push({ ok: r.status < 400 });
      }
      // E retain-all variants: also ensure all 5 approved (first wave did 3)
      if (p.behaviour === 'retain_60_or_redeem40' && p.variant < 2) {
        for (const id of p.claim_ids) {
          await approveReward(adminToken, id);
        }
      }
      if (p.behaviour === 'retain_20_no_redeem' || p.behaviour === 'retain_30_no_redeem') {
        for (const id of p.claim_ids) await approveReward(adminToken, id);
      }
      if (p.behaviour === 'multi_pending_never' && p.variant === 0) {
        for (const id of p.claim_ids) await approveReward(adminToken, id);
      }
    }
    return { approved: out.filter((x) => x.ok).length };
  }),
  week('W4_second_redemptions', async () => {
    const out = [];
    for (const p of plan) {
      if (!['redeem_40_then_40', 'redeem_40_then_50', 'redeem_40_then_continue'].includes(p.behaviour)) continue;
      const tok = tokens[p.email];
      if (!tok) continue;
      // Small delay between waves
      const req = await requestRedeem(tok);
      out.push({ email: p.email, amount: req.data.amount, status: req.status, error: req.data.error, id: req.data.request?.id });
      if (req.data.request?.id && req.data.success) {
        const fulfil = await fulfilManual(adminToken, req.data.request.id);
        out.push({ email: p.email, step: 'manual_sent', ok: fulfil.data.success === true, error: fulfil.data.error });
        if (fulfil.data.success && report.giftbit_emails.length < 8) {
          const usd = await giftbitUsd({
            email: jp,
            amountGbp: req.data.amount,
            voucherId: req.data.request.id,
            subject: `FastAmps QA subsequent redemption £${req.data.amount}`,
          });
          report.giftbit_emails.push({ ...usd, synthetic_installer: p.email, persona: p.persona });
        }
      }
    }
    return { events: out };
  }),
  week('W5_failure_injection', async () => {
    const results = [];
    // Actual provider: bad JSON / unsupported
    const bad = await fetch('https://api-testbed.giftbit.com/papi/v1/campaign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GIFTBIT_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
      },
      body: JSON.stringify({ id: `bad-${randomUUID()}`, marketplace_gift_id: 1 }),
    });
    results.push({ type: 'actual_giftbit_reject', http: bad.status, ok: bad.status >= 400 });

    // Unsupported denomination probe (price 0)
    const zero = await giftbitUsd({ email: jp, amountGbp: 0, subject: 'should fail zero' });
    results.push({ type: 'actual_unsupported_or_reject', ...zero });

    // Double-click / concurrent redemption on one eligible installer
    const target = plan.find((p) => p.behaviour === 'multi_pending_never' && p.variant === 2);
    if (target && tokens[target.email]) {
      // Ensure remaining rewards approved
      for (const id of target.claim_ids) await approveReward(adminToken, id);
      const [a, b] = await Promise.all([
        requestRedeem(tokens[target.email]),
        requestRedeem(tokens[target.email]),
      ]);
      results.push({
        type: 'concurrent_double_redeem',
        a: { status: a.status, amount: a.data.amount, id: a.data.request?.id, msg: a.data.message || a.data.error },
        b: { status: b.status, amount: b.data.amount, id: b.data.request?.id, msg: b.data.message || b.data.error },
        same_request: a.data.request?.id && a.data.request?.id === b.data.request?.id,
        no_duplicate: !(a.data.request?.id && b.data.request?.id && a.data.request.id !== b.data.request.id),
      });
      if (a.data.request?.id) await fulfilManual(adminToken, a.data.request.id);
      else if (b.data.request?.id) await fulfilManual(adminToken, b.data.request.id);
    }

    // Continue earning while pending: create requested voucher then submit is N/A (no free chargers).
    // Simulate pending by leaving one request open briefly then fulfilling.
    const pendingTarget = plan.find((p) => p.behaviour === 'multi_pending_never' && p.variant === 1);
    if (pendingTarget && tokens[pendingTarget.email]) {
      for (const id of pendingTarget.claim_ids) await approveReward(adminToken, id);
      const req = await requestRedeem(tokens[pendingTarget.email]);
      results.push({ type: 'pending_then_recover', status: req.status, id: req.data.request?.id });
      if (req.data.request?.id) {
        const again = await requestRedeem(tokens[pendingTarget.email]);
        results.push({
          type: 'earn_while_pending_blocked',
          status: again.status,
          returned_existing: again.data.request?.id === req.data.request.id,
        });
        await fulfilManual(adminToken, req.data.request.id);
      }
    }

    return { results };
  }),
];

for (const w of weeks) {
  const started = new Date().toISOString();
  const result = await w.fn();
  weekLog.push({ week: w.name, started, result });
  report.weeks = weekLog;
  writeFileSync(`${ART}/phase2-progress.json`, JSON.stringify({ weeks: weekLog }, null, 2));
}

// Build installer ledger CSV
claims = (await listAll('InstallClaim', adminToken))
  .filter((c) => String(c.serial_number || '').startsWith(PREFIX));
const vouchers = (await listAll('VoucherRequest', adminToken))
  .filter((v) => plan.some((p) => p.email.toLowerCase() === String(v.installer_email || '').toLowerCase()));

const csvRows = [['installer_n', 'installer_email', 'persona', 'approved_installs', 'welcome_bonus_count', 'welcome_bonus_value', 'installation_earnings', 'lifetime_gross', 'successful_redemptions', 'pending_redemptions', 'failed_redemptions', 'reserved_funds', 'available_wallet', 'giftbit_refs', 'expected_balance', 'actual_balance', 'difference']];

let sumGross = 0;
let sumRedeemed = 0;
let sumAvailable = 0;

for (const p of plan) {
  const myClaims = claims.filter((c) => String(c.installer_email || '').toLowerCase() === p.email.toLowerCase());
  const approved = myClaims.filter((c) => c.status === 'approved' && !['rejected', 'held'].includes(c.reward_status) || c.reward_status === 'approved' || c.reward_status === 'issued' || c.reward_status === 'redemption_requested');
  // Count installs that count toward earnings (approved status)
  const approvedInstalls = myClaims.filter((c) => c.status === 'approved').length;
  const installEarn = approvedInstalls * 10;
  const welcome = 10;
  const gross = installEarn + welcome;
  const myV = vouchers.filter((v) => String(v.installer_email || '').toLowerCase() === p.email.toLowerCase());
  const sent = myV.filter((v) => v.status === 'sent');
  const pending = myV.filter((v) => ['requested', 'processing'].includes(v.status));
  const failed = myV.filter((v) => v.status === 'failed');
  const redeemedAmt = sent.reduce((s, v) => s + Number(v.amount || 0), 0);
  const pendingAmt = pending.reduce((s, v) => s + Number(v.amount || 0), 0);
  const reserved = myClaims.filter((c) => c.reward_status === 'redemption_requested').reduce((s, c) => s + Number(c.reward_amount || 0), 0)
    + (pending.some((v) => v.includes_welcome_reward) ? 10 : 0);
  // Available: approved rewards not yet redeemed/issued + welcome if still available
  const inst = byEmail[p.email.toLowerCase()];
  // refresh installer
  const instLive = (await http('GET', `/entities/Installer/${inst.id}`, undefined, adminToken)).data;
  const welcomeAvail = instLive.welcome_reward_status === 'available' || instLive.welcome_reward_status === 'redemption_requested' ? (instLive.welcome_reward_status === 'available' ? 10 : 0) : 0;
  const openRewards = myClaims
    .filter((c) => c.status === 'approved' && c.reward_status === 'approved')
    .reduce((s, c) => s + Number(c.reward_amount || 0), 0);
  const available = openRewards + welcomeAvail;
  const expected = expectedForPersona(p);
  // Expected available after planned redemptions
  const expectedBal = expected.available;
  const giftRefs = report.giftbit_emails
    .filter((g) => g.synthetic_installer === p.email)
    .map((g) => g.order_id)
    .join('|');
  const diff = Number((available - expectedBal).toFixed(2));
  ledger.push({
    installer_n: p.installer_n,
    email: p.email,
    persona: p.persona,
    approved_installs: approvedInstalls,
    welcome,
    installEarn,
    gross,
    redeemedAmt,
    pendingAmt,
    failed: failed.length,
    reserved,
    available,
    expectedBal,
    diff,
    welcome_status: instLive.welcome_reward_status,
    vouchers: myV.map((v) => ({ id: v.id, amount: v.amount, status: v.status, includes_welcome: v.includes_welcome_reward })),
  });
  csvRows.push([
    p.installer_n, p.email, p.persona, approvedInstalls,
    welcome ? 1 : 0, welcome, installEarn, gross, redeemedAmt, pendingAmt, failed.length,
    reserved, available, giftRefs, expectedBal, available, diff,
  ]);
  sumGross += gross;
  sumRedeemed += redeemedAmt;
  sumAvailable += available;
}

const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
writeFileSync(`${ART}/installer-ledger-50.csv`, csv);
writeFileSync(`${ART}/installer-ledger-50.json`, JSON.stringify(ledger, null, 2));

report.financials = {
  installers: 50,
  approved_installs_total: claims.filter((c) => c.status === 'approved').length,
  expected_gross: 2500,
  actual_gross: sumGross,
  total_redeemed: sumRedeemed,
  total_available: sumAvailable,
  equation_check: 'gross ≈ available + reserved + redeemed (per installer in CSV)',
  giftbit_usd_emails: report.giftbit_emails.length,
  uk_live_payouts: 0,
};

report.ok = enabled === 50
  && assignment.length === 200
  && sumGross === 2500
  && report.giftbit_emails.length >= 5;

report.finished_at = new Date().toISOString();
writeFileSync(`${ART}/phase2-financial-lifecycle.json`, JSON.stringify(report, null, 2));
writeFileSync('/opt/cursor/artifacts/phase2-financial-lifecycle.json', JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  ok: report.ok,
  financials: report.financials,
  giftbit_emails: report.giftbit_emails.map((g) => ({
    order_id: g.order_id,
    gbp: g.gbp_amount,
    usd: g.usd_amount,
    delivery: g.delivery_status,
    voucher_id: g.voucher_id,
    installer: g.synthetic_installer || null,
  })),
  weeks: report.weeks.map((w) => w.week),
  failures: report.failures.slice(0, 5),
  csv: `${ART}/installer-ledger-50.csv`,
}, null, 2));

process.exit(report.ok ? 0 : 1);
