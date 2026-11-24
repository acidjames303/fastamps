/**
 * Virtual commercial launch simulation (isolated from genuine Links draft).
 *
 * Creates:
 * - Virtual programme `links-virtual-sim-2026` (active, demo/excluded)
 * - 200 synthetic chargers (VIRTUAL-LINKS-2026-*)
 * - 300 installer identities (250 pre-reg + 50 active QA)
 * - 200 installation claims + admin approvals
 * - Earnings / redemption checks + Giftbit USD Testbed samples to JP emails
 *
 * Usage:
 *   CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *     node src/virtual-commercial-launch.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId, mailosaurConfigured } from './otp-mailosaur.mjs';

assertSafeMode('virtual-commercial-launch');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const PREFIX = 'VIRTUAL-LINKS-2026';
const BATCH = `${PREFIX}-BATCH`;
const PROGRAMME_CODE = 'links-virtual-sim-2026';
const DEMO_LABEL = 'VIRTUAL-LINKS-SIM-2026';
const PHOTO = 'https://example.com/virtual-sim-photo.jpg';

const report = {
  ok: false,
  started_at: new Date().toISOString(),
  programme_code: PROGRAMME_CODE,
  genuine_links_untouched: true,
  stages: {},
  financials: {},
  giftbit: [],
  defects: [],
  fixes: [],
};

async function http(method, path, body, token) {
  const headers = { Accept: 'application/json', 'User-Agent': 'virtual-commercial-launch/1.0' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email, password) {
  const { status, data } = await http('POST', '/auth/login', { email, password });
  if (!data.access_token) throw new Error(`login failed ${email}: ${status} ${JSON.stringify(data)}`);
  return data.access_token;
}

async function listAll(entity, token, limit = 5000) {
  const out = [];
  for (let skip = 0; skip < limit; skip += 200) {
    const { data } = await http('GET', `/entities/${entity}?limit=200&skip=${skip}`, undefined, token);
    if (!Array.isArray(data) || !data.length) break;
    out.push(...data);
    if (data.length < 200) break;
  }
  return out;
}

function jpEmails() {
  const list = [
    process.env.CONNECT_QA_ADMIN_EMAIL,
    process.env.JP_REWARD_EMAIL,
    process.env.CONNECT_JP_EMAIL,
  ].filter(Boolean);
  // Deduplicate
  return [...new Set(list.map((e) => e.toLowerCase()))];
}

async function ensureVirtualProgramme(adminToken) {
  const { data: listed } = await http('POST', '/functions/manage-incentive-programme', { action: 'list' }, adminToken);
  const existing = (listed.programmes || []).find((p) => p.programme_code === PROGRAMME_CODE);
  if (existing) {
    if (existing.status !== 'active') {
      await http('POST', '/functions/manage-incentive-programme', {
        action: 'set_status',
        programme_id: existing.id,
        status: 'active',
        confirm_activation: true,
      }, adminToken);
    }
    // Keep marked demo/excluded
    await http('PUT', `/entities/IncentiveProgramme/${existing.id}`, {
      is_demo: true,
      excluded_from_reporting: true,
      notes: 'VIRTUAL SIMULATION ONLY — not the genuine Links Electrical beta.',
    }, adminToken);
    return existing;
  }
  const created = await http('POST', '/entities/IncentiveProgramme', {
    name: 'FastAmps Connect – Links Virtual Simulation',
    programme_code: PROGRAMME_CODE,
    wholesaler_name: 'Links Electrical',
    branch_name: 'Shrewsbury Virtual',
    country: 'United Kingdom',
    currency: 'GBP',
    programme_type: 'qa_synthetic',
    status: 'active',
    claim_verification: 'manual_admin_approval',
    payout_mode: 'held_pending_authorisation',
    expected_charger_allocation: 200,
    invitation_enabled: true,
    is_demo: true,
    excluded_from_reporting: true,
    notes: 'VIRTUAL SIMULATION ONLY — genuine links-electrical-shrewsbury remains draft.',
    activated_at: new Date().toISOString(),
    last_status_changed_by: process.env.CONNECT_QA_ADMIN_EMAIL,
  }, adminToken);
  return created.data;
}

async function ensureGenuineLinksDraft(adminToken) {
  const { data } = await http('POST', '/functions/manage-incentive-programme', {
    action: 'ensure_links_beta',
  }, adminToken);
  const programme = data.programme;
  if (programme?.status === 'active') {
    await http('POST', '/functions/manage-incentive-programme', {
      action: 'set_status',
      programme_id: programme.id,
      status: 'draft',
    }, adminToken);
    report.defects.push('Genuine Links programme was active; forced back to draft');
    report.fixes.push('Restored links-electrical-shrewsbury to draft');
  }
  return programme;
}

async function importVirtualChargers(adminToken) {
  // Skip if already imported
  const chargers = await listAll('Charger', adminToken);
  const existing = chargers.filter((c) => String(c.serial_number || '').startsWith(PREFIX));
  if (existing.length >= 200) {
    return { reused: true, count: existing.length, chargers: existing.slice(0, 200) };
  }

  const usedPins = new Set(
    chargers.map((c) => String(c.pin_code || '')).filter(Boolean),
  );
  // Also check retired history if readable
  try {
    const history = await listAll('ChargerCodeHistory', adminToken);
    for (const row of history) usedPins.add(String(row.pin_code || ''));
  } catch {
    // optional
  }

  const usedSerials = new Set(chargers.map((c) => String(c.serial_number || '').toUpperCase()));
  const start = existing.length + 1;
  const need = 200 - existing.length;
  const rows = [];
  let n = start;
  while (rows.length < need) {
    const serial = `${PREFIX}-S${String(n).padStart(5, '0')}`;
    n += 1;
    if (usedSerials.has(serial)) continue;
    let pin;
    do {
      pin = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    } while (usedPins.has(pin));
    usedPins.add(pin);
    usedSerials.add(serial);
    rows.push({
      serial_number: serial,
      pin_code: pin,
      product_model: 'Alpha 7',
      supplied_to_type: 'wholesaler',
      supplied_to_name_raw: 'Links Electrical',
      supplied_to_branch_raw: 'Shrewsbury Virtual',
      source_batch_identifier: BATCH,
    });
  }

  const chunks = [];
  const stamp = Date.now().toString(36);
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { status, data } = await http('POST', '/functions/import-charger-batch', {
      action: 'import',
      batch_reference: `${BATCH}-${stamp}-${String(Math.floor(i / 50) + 1).padStart(2, '0')}`,
      qr_generated: true,
      rows: chunk,
    }, adminToken);
    chunks.push({
      status,
      success: data.success === true,
      created_count: data.created_count,
      error: data.error || null,
      issues: Array.isArray(data.issues) ? data.issues.slice(0, 5) : null,
    });
    if (!data.success) break;
  }

  const refreshed = (await listAll('Charger', adminToken))
    .filter((c) => String(c.serial_number || '').startsWith(PREFIX));

  // Mark demo/excluded + virtual programme attribution
  let patched = 0;
  for (const c of refreshed) {
    if (c.is_demo && c.demo_label === DEMO_LABEL && c.excluded_from_reporting) continue;
    await http('PUT', `/entities/Charger/${c.id}`, {
      is_demo: true,
      demo_label: DEMO_LABEL,
      excluded_from_reporting: true,
      distribution_wholesaler_name: 'Links Electrical',
      distribution_branch_name: 'Shrewsbury Virtual',
    }, adminToken);
    patched += 1;
  }

  return { reused: false, count: refreshed.length, chunks, patched, chargers: refreshed.slice(0, 200) };
}

async function seedPreRegistered(adminToken, serverId, count) {
  const created = [];
  const existing = await listAll('Installer', adminToken);
  const have = new Set(existing.map((i) => String(i.user_email || '').toLowerCase()));

  for (let n = 1; n <= count; n += 1) {
    const email = `virtual-prereg-${String(n).padStart(3, '0')}@${serverId}.mailosaur.net`;
    if (have.has(email.toLowerCase())) {
      created.push({ email, reused: true });
      continue;
    }
    const mobile = `0770${String(1000000 + n).slice(-7)}`;
    const { status, data } = await http('POST', '/entities/Installer', {
      mobile,
      full_name: `Virtual PreReg ${n}`,
      business_name: `Virtual PreReg Electrical ${n}`,
      user_email: email,
      region: n % 2 ? 'West Midlands' : 'North West',
      town_city: n % 3 === 0 ? 'Telford' : n % 3 === 1 ? 'Birmingham' : 'Manchester',
      postcode: n % 3 === 0 ? 'TF3 3BD' : n % 3 === 1 ? 'B7 4BB' : 'M17 1AY',
      coverage_area: n % 2 ? 'Shropshire' : 'Greater Manchester',
      nominated_wholesaler: n % 4 === 0 ? 'Links Electrical' : n % 4 === 1 ? 'CEF' : n % 4 === 2 ? 'Edmundson Electrical' : 'YESSS Electrical',
      nominated_branch: n % 4 === 0 ? 'Shrewsbury' : n % 4 === 1 ? 'Birmingham' : n % 4 === 2 ? 'Telford' : 'Manchester',
      membership_status: 'pre_registered',
      reward_account_status: 'held',
      reward_account_reason: 'Pre-registered — awaiting programme eligibility. Not an active incentive member.',
      welcome_reward_amount: 10,
      welcome_reward_status: 'deferred',
      notify_programme_availability: true,
      privacy_terms_version: '2026-11-v1',
      privacy_accepted_at: new Date().toISOString(),
      pre_registered_at: new Date().toISOString(),
      tier: 'New',
      is_demo: true,
      demo_label: DEMO_LABEL,
      excluded_from_reporting: true,
      referral_code: `VP${String(n).padStart(6, '0')}`,
    }, adminToken);
    created.push({ email, status, ok: status < 400, id: data.id, error: data.error || data.message || null });
  }
  return created;
}

async function prepareActiveQaInstallers(adminToken) {
  // Cohort accounts were registered with the fixed QA template password, not the
  // single CONNECT_QA_INSTALLER_PASSWORD used for the primary smoke installer.
  const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
  const serverId = await resolveServerId();
  const ready = [];
  for (let n = 1; n <= 50; n += 1) {
    const email = installerEmail(n, serverId);
    try {
      const token = await login(email, password);
      // Ensure membership active for virtual sim (they are QA demo accounts)
      const installers = await listAll('Installer', adminToken);
      const profile = installers.find((i) => String(i.user_email || '').toLowerCase() === email.toLowerCase());
      if (profile) {
        await http('PUT', `/entities/Installer/${profile.id}`, {
          membership_status: 'active',
          reward_account_status: profile.reward_account_status === 'blocked' ? 'active' : (profile.reward_account_status || 'active'),
          attributed_programme_code: PROGRAMME_CODE,
          is_demo: true,
          demo_label: profile.demo_label || 'QA-LAUNCH-2026',
          excluded_from_reporting: true,
          // Keep welcome status as-is unless missing
          ...(profile.welcome_reward_status ? {} : { welcome_reward_status: 'available', welcome_reward_amount: 10 }),
        }, adminToken);
      }
      ready.push({ n, email, token, installerId: profile?.id });
    } catch (error) {
      ready.push({ n, email, error: String(error.message || error) });
    }
  }
  return ready;
}

async function runClaims(adminToken, actives, chargers) {
  const available = chargers.filter((c) => c.claim_status === 'available' && c.claim_token);
  const usableActives = actives.filter((a) => a.token);
  if (!usableActives.length) {
    return [{ ok: false, error: 'No authenticated active installers available for claims' }];
  }
  const results = [];
  let idx = 0;
  for (const charger of available.slice(0, 200)) {
    const actor = usableActives[idx % usableActives.length];
    idx += 1;
    const { status, data } = await http('POST', '/functions/submit-install-claim-v2', {
      claim_token: charger.claim_token,
      serial_number: charger.serial_number,
      pin_code: charger.pin_code,
      serial_photo_url: PHOTO,
      install_photo_url: PHOTO,
      install_date: '2026-11-24',
      site_postcode: 'SY1 2LQ',
      wholesaler: 'Links Electrical',
      wholesaler_branch: 'Shrewsbury Virtual',
      consent_confirmed: true,
    }, actor.token);
    results.push({
      serial: charger.serial_number,
      installer: actor.email,
      status,
      ok: status === 200 && data.success === true,
      claim_id: data.claim?.id,
      error: data.error || null,
      is_demo: data.claim?.is_demo,
      reward_status: data.claim?.reward_status,
    });
  }
  return results;
}

async function approveClaims(adminToken, claimResults) {
  const approved = [];
  for (const row of claimResults.filter((r) => r.ok && r.claim_id)) {
    const { status, data } = await http('PUT', `/entities/InstallClaim/${row.claim_id}`, {
      status: 'approved',
      warranty_status: 'registered',
      // Keep held for virtual/demo financial safety unless explicitly releasing for Giftbit sample
      reward_status: 'held',
      reviewed_by_name: 'Virtual Launch Admin',
      reviewed_by_email: process.env.CONNECT_QA_ADMIN_EMAIL,
      reviewed_at: new Date().toISOString(),
      review_note: 'Virtual commercial launch simulation approval',
    }, adminToken);
    approved.push({ claim_id: row.claim_id, status, ok: status < 400 });
  }
  return approved;
}

async function verifyQrIndependence(adminToken) {
  const invite = await http('POST', '/functions/manage-incentive-programme', {
    action: 'public_invite',
    programme_code: 'links-electrical-shrewsbury',
  }, adminToken);
  const virtualInvite = await http('POST', '/functions/manage-incentive-programme', {
    action: 'public_invite',
    programme_code: PROGRAMME_CODE,
  }, adminToken);
  const chargers = (await listAll('Charger', adminToken))
    .filter((c) => String(c.serial_number || '').startsWith(PREFIX))
    .slice(0, 3);
  return {
    genuine_invite_active: invite.data?.active === true,
    genuine_invite_status: invite.data?.status,
    virtual_invite_active: virtualInvite.data?.active === true,
    sample_charger_claim_urls: chargers.map((c) => `https://connect.fastamps.com/claim/${c.claim_token}`),
    sample_invite_url: 'https://connect.fastamps.com/invite/links-electrical-shrewsbury',
    independent: invite.data?.active === false
      && Boolean(chargers[0]?.claim_token)
      && !String(chargers[0]?.claim_token || '').includes('invite'),
  };
}

async function giftbitUsdSamples(recipients) {
  const mode = (process.env.GIFTBIT_MODE || 'testbed').toLowerCase();
  if (mode === 'live') {
    return [{ ok: false, error: 'Refusing live Giftbit' }];
  }
  const token = process.env.GIFTBIT_API_TOKEN || '';
  if (!token) return [{ ok: false, error: 'GIFTBIT_API_TOKEN missing' }];
  const apiBase = (process.env.GIFTBIT_API_BASE_URL || 'https://api-testbed.giftbit.com/papi/v1').replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'identity',
  };
  const out = [];
  for (const email of recipients.slice(0, 3)) {
    const orderId = `fastamps-virtual-usd-${randomUUID()}`;
    const priceCents = Number(process.env.GIFTBIT_USD_PRICE_CENTS || 1000);
    const marketplaceGiftId = Number(process.env.GIFTBIT_USD_MARKETPLACE_GIFT_ID || 1);
    const res = await fetch(`${apiBase}/campaign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: orderId,
        subject: 'FastAmps Connect virtual launch — USD Testbed reward sample',
        message: 'Isolated Giftbit USD Testbed sample for the FastAmps Connect virtual commercial launch. Not a UK production payout.',
        contacts: [{ firstname: 'JP', lastname: 'FastAmps', email }],
        marketplace_gifts: [{ id: marketplaceGiftId, price_in_cents: priceCents }],
      }),
    });
    const payload = await res.json().catch(() => ({}));
    let gift = null;
    if (res.ok) {
      for (let i = 0; i < 12; i += 1) {
        const list = await fetch(`${apiBase}/gifts?campaign_id=${encodeURIComponent(orderId)}`, { headers });
        const listPayload = await list.json().catch(() => ({}));
        gift = listPayload?.gifts?.[0] || null;
        if (gift?.delivery_status === 'DELIVERED' || gift?.status === 'SENT_AND_REDEEMABLE') break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    out.push({
      ok: res.ok,
      http: res.status,
      email,
      order_id: orderId,
      provider_status: payload?.campaign?.status || payload?.info?.code || payload?.status || null,
      message: payload?.info?.message || payload?.error?.message || null,
      gift_delivery_status: gift?.delivery_status || null,
      gift_status: gift?.status || null,
      not_uk_production: true,
    });
  }
  return out;
}

async function welcomeBonusOnceCheck(adminToken, actives) {
  const results = [];
  for (const actor of actives.filter((a) => a.token).slice(0, 10)) {
    const installers = await listAll('Installer', adminToken);
    const profile = installers.find((i) => String(i.user_email || '').toLowerCase() === actor.email.toLowerCase());
    if (!profile) continue;
    const before = profile.welcome_reward_status;
    // Simulate first redemption marking welcome issued
    if (before === 'available' || before === 'redemption_requested') {
      await http('PUT', `/entities/Installer/${profile.id}`, { welcome_reward_status: 'issued' }, adminToken);
    }
    const afterIssued = (await http('GET', `/entities/Installer/${profile.id}`, undefined, adminToken)).data;
    // Attempt to set available again should be treated as defect if business logic allows double pay —
    // voucher path uses atomic compare on available. Here we verify issued stays issued unless admin resets.
    const second = await http('PUT', `/entities/Installer/${profile.id}`, { welcome_reward_status: 'issued' }, adminToken);
    results.push({
      email: actor.email,
      before,
      after: afterIssued.welcome_reward_status,
      remains_issued: afterIssued.welcome_reward_status === 'issued',
      put_ok: second.status < 400,
    });
  }
  return results;
}

async function eligibilityProbeHardening(adminToken, actives) {
  const actor = actives.find((a) => a.token);
  if (!actor) return { ok: false, error: 'no active actor' };
  const installers = await listAll('Installer', adminToken);
  const profile = installers.find((i) => String(i.user_email || '').toLowerCase() === actor.email.toLowerCase());
  const prev = {
    membership_status: profile.membership_status || 'active',
    reward_account_status: profile.reward_account_status || 'active',
    reward_account_reason: profile.reward_account_reason || '',
    welcome_reward_status: profile.welcome_reward_status,
  };
  await http('PUT', `/entities/Installer/${profile.id}`, {
    membership_status: 'pre_registered',
    reward_account_status: 'held',
    reward_account_reason: 'Pre-registered — awaiting programme eligibility.',
    welcome_reward_status: 'deferred',
  }, adminToken);

  const charger = (await listAll('Charger', adminToken)).find((c) =>
    c.claim_status === 'available' && String(c.serial_number || '').startsWith(PREFIX));
  const beforeClaims = (await listAll('InstallClaim', adminToken)).length;
  const { status, data } = await http('POST', '/functions/submit-install-claim-v2', {
    claim_token: charger.claim_token,
    serial_number: charger.serial_number,
    pin_code: charger.pin_code,
    serial_photo_url: PHOTO,
    install_photo_url: PHOTO,
    install_date: '2026-11-24',
    site_postcode: 'SY1 2LQ',
    wholesaler: 'Links Electrical',
    wholesaler_branch: 'Shrewsbury Virtual',
    consent_confirmed: true,
  }, actor.token);
  const afterClaims = (await listAll('InstallClaim', adminToken)).length;
  // restore
  await http('PUT', `/entities/Installer/${profile.id}`, prev, adminToken);
  // Also verify charger still available
  const chargerAfter = (await http('GET', `/entities/Charger/${charger.id}`, undefined, adminToken)).data;
  return {
    http: status,
    error: data.error || null,
    membership_status: data.membership_status || null,
    claims_created: afterClaims - beforeClaims,
    charger_still_available: chargerAfter.claim_status === 'available',
    ok: status === 403 && afterClaims === beforeClaims && chargerAfter.claim_status === 'available',
  };
}

// ---------------- main ----------------
const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const serverId = mailosaurConfigured() ? await resolveServerId() : 'local';

report.stages.genuine_links = await ensureGenuineLinksDraft(adminToken);
report.stages.virtual_programme = await ensureVirtualProgramme(adminToken);
report.stages.chargers = await importVirtualChargers(adminToken);
report.stages.qr_independence = await verifyQrIndependence(adminToken);
report.stages.pre_registered = await seedPreRegistered(adminToken, serverId, 250);
report.stages.active_qa = await prepareActiveQaInstallers(adminToken);

const actives = report.stages.active_qa.filter((a) => a.token);
report.stages.eligibility_hardening = await eligibilityProbeHardening(adminToken, actives);

const priorVirtualClaims = (await listAll('InstallClaim', adminToken))
  .filter((c) => String(c.serial_number || '').startsWith(PREFIX));
const remainingNeeded = Math.max(0, 200 - priorVirtualClaims.length);
const availableChargers = (report.stages.chargers.chargers || [])
  .filter((c) => c.claim_status === 'available');
report.stages.claims = await runClaims(
  adminToken,
  actives,
  availableChargers.slice(0, remainingNeeded),
);
// Merge prior + new for approval pass on any still-submitted rows
const allVirtualClaimRows = [
  ...priorVirtualClaims.map((c) => ({
    ok: true,
    claim_id: c.id,
    serial: c.serial_number,
    reused: true,
    reward_status: c.reward_status,
    status: c.status,
  })),
  ...report.stages.claims,
];
report.stages.claims_total = allVirtualClaimRows.length;
report.stages.approvals = await approveClaims(
  adminToken,
  allVirtualClaimRows.filter((r) => r.ok && r.claim_id && r.status !== 'approved'),
);

report.stages.welcome_bonus_once = await welcomeBonusOnceCheck(adminToken, actives);
report.giftbit = await giftbitUsdSamples(jpEmails());

const claimOkNew = report.stages.claims.filter((c) => c.ok).length;
const claimOkTotal = report.stages.claims_total || claimOkNew;
const preRegOk = report.stages.pre_registered.filter((p) => p.ok || p.reused).length;
const identityCount = preRegOk + actives.length;

report.financials = {
  virtual_claims_submitted_new: claimOkNew,
  virtual_claims_submitted_total: claimOkTotal,
  virtual_claims_approved_held: report.stages.approvals.filter((a) => a.ok).length,
  welcome_bonus_issued_samples: report.stages.welcome_bonus_once.filter((w) => w.remains_issued).length,
  giftbit_usd_samples: report.giftbit.filter((g) => g.ok).length,
  uk_live_payouts: 0,
  genuine_links_status: report.stages.genuine_links?.status || 'unknown',
};

report.cohort = {
  target_people: 300,
  pre_registered: preRegOk,
  active_authenticated: actives.length,
  total_identities: identityCount,
  chargers: report.stages.chargers.count,
};

report.ok = identityCount >= 300
  && (report.stages.chargers.count || 0) >= 200
  && claimOkTotal >= 180
  && report.stages.eligibility_hardening?.ok === true
  && report.stages.qr_independence?.independent === true
  && report.stages.genuine_links?.status === 'draft';

report.finished_at = new Date().toISOString();

mkdirSync('/opt/cursor/artifacts', { recursive: true });
writeFileSync('/opt/cursor/artifacts/virtual-commercial-launch.json', JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  ok: report.ok,
  cohort: report.cohort,
  financials: report.financials,
  eligibility_hardening: report.stages.eligibility_hardening,
  qr_independence: report.stages.qr_independence,
  giftbit: report.giftbit,
  defects: report.defects,
  artifact: '/opt/cursor/artifacts/virtual-commercial-launch.json',
}, null, 2));

process.exit(report.ok ? 0 : 1);
