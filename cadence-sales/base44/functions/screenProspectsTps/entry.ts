import { resolveTenant } from '../../shared/tenantAuth.ts';
import {
  normaliseUkNumber,
  resolveProdataToken,
  screenProdataNumbers,
  loadSuppressedHashes,
  suppressedNumbers,
  PRODATA_MESSAGES,
} from '../../shared/prodata.ts';

// TPS / CTPS screening for prospecting lists, using the 121 Prodata bulk API.
//
// Fail-closed rules enforced here:
//  - the tenant's own key is used first; the platform key only for the owner org
//  - a whole batch is abandoned (nothing written) if the provider errors, the
//    transaction reference is missing, or the validity date is missing
//  - a number only becomes "safe" when the provider returned a matching
//    per-number reference and a usable safe verdict inside the validity window
//  - any number on our own do-not-call list is treated as listed, never safe
const CHUNK = 250;
const CHUNK_PAUSE_MS = 2000;
const ALLOWED_CAPABILITIES = ['prospecting', 'calling', 'providers'];

// Collects every distinct number on each prospect, with a human label for where
// it came from, so a row can show exactly which number is listed.
function collectNumbers(prospects) {
  const roles = new Map();
  const perProspect = new Map();
  for (const p of prospects) {
    const nums = new Set();
    const add = (raw, role) => {
      const n = normaliseUkNumber(raw);
      if (!n) return;
      nums.add(n);
      if (!roles.has(n)) roles.set(n, role);
    };
    add(p.mobile, 'Mobile');
    add(p.direct_dial, 'Direct dial');
    add(p.company_phone, 'Company switchboard');
    add(p.phone, 'Primary number');
    add(p.landline, 'Switchboard');
    for (const c of Array.isArray(p.contacts) ? p.contacts : []) {
      const who = c?.name ? ` (${c.name})` : '';
      add(c?.mobile, `Mobile${who}`);
      add(c?.direct_dial, `Direct dial${who}`);
      add(c?.phone, `Phone${who}`);
    }
    if (nums.size) perProspect.set(p.id, [...nums]);
  }
  return { roles, perProspect };
}

export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    const permitted = ALLOWED_CAPABILITIES.some((c) => (profile.capabilities || []).includes(c));
    if (!permitted) {
      return Response.json({ error: 'Your role does not permit TPS/CTPS screening.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const listId = body?.list_id;
    const ids = Array.isArray(body?.prospect_ids) ? body.prospect_ids.slice(0, 500) : [];
    if (!listId) return Response.json({ error: 'A prospect list is required.' }, { status: 400 });

    const list = await base44.asServiceRole.entities.ProspectList.get(listId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!list || list.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
    }

    const all = await base44.asServiceRole.entities.Prospect.filter({ list_id: listId }, '-created_date', 500);
    const targets = (ids.length ? all.filter((p) => ids.includes(p.id)) : all)
      .filter((p) => !p.organisation_id || p.organisation_id === org.id);
    if (!targets.length) {
      return Response.json({ checked: 0, safe: 0, listed: 0, unavailable: 0, skipped: 0, suppressed: 0 });
    }

    const resolved = await resolveProdataToken(base44, org);
    if (!resolved.token) {
      return Response.json(
        {
          error: '121 Prodata is not connected. Save the API token for this organisation to run TPS/CTPS checks.',
          code: 'no_token',
        },
        { status: 400 },
      );
    }

    const { roles, perProspect } = collectNumbers(targets);

    // Numbers held per person (imported, provider-returned). Each one is screened
    // on its own, and a number outside the UK registers never receives a UK verdict.
    const phoneRecords = await base44.asServiceRole.entities.ContactPhone
      .filter({ list_id: listId }, '-created_date', 1000)
      .catch(() => []);
    const targetIds = new Set(targets.map((p) => p.id));
    const phoneTargets = (phoneRecords || []).filter(
      (row) => targetIds.has(row.prospect_id) && row.normalised && row.country !== 'IE',
    );
    for (const row of phoneTargets) {
      const number = normaliseUkNumber(row.normalised);
      if (number && !roles.has(number)) {
        roles.set(number, `${row.phone_type || 'Number'} (${row.person_name || 'contact'})`);
      }
    }
    const numbers = [...roles.keys()];
    if (!numbers.length) {
      return Response.json({ checked: 0, safe: 0, listed: 0, unavailable: 0, skipped: targets.length, suppressed: 0 });
    }

    // Our own do-not-call list always wins over the registers.
    const suppressedSet = await suppressedNumbers(numbers, await loadSuppressedHashes(base44, org));
    const toScreen = numbers.filter((n) => !suppressedSet.has(n));

    const verdicts = new Map();
    let reference = '';
    let validUntil = '';
    let creditsUsed = 0;

    for (let i = 0; i < toScreen.length; i += CHUNK) {
      const slice = toScreen.slice(i, i + CHUNK);
      const entries = slice.map((n, idx) => ({ number: n, specific_reference: `c${i + idx}` }));
      const out = await screenProdataNumbers(resolved.token, entries);

      if (!out.ok) {
        return Response.json(
          { error: out.detail || PRODATA_MESSAGES.provider_error, code: out.code || 'provider_error' },
          { status: 502 },
        );
      }
      if (!out.reference || !out.valid_until) {
        return Response.json(
          { error: PRODATA_MESSAGES.response_invalid, code: 'response_invalid' },
          { status: 502 },
        );
      }
      if (!out.rows.size) {
        return Response.json(
          { error: PRODATA_MESSAGES.response_invalid, code: 'response_invalid' },
          { status: 502 },
        );
      }

      reference = out.reference;
      validUntil = out.valid_until;
      creditsUsed += out.credits || 0;
      for (const [number, verdict] of out.rows) verdicts.set(number, verdict);

      if (i + CHUNK < toScreen.length) {
        await new Promise((r) => setTimeout(r, CHUNK_PAUSE_MS));
      }
    }

    const usableUntil = validUntil && new Date(validUntil).getTime() > Date.now() ? validUntil : '';
    const now = new Date().toISOString();
    const updates = [];
    let safe = 0;
    let listed = 0;
    let unavailable = 0;
    let skipped = 0;

    for (const p of targets) {
      const nums = perProspect.get(p.id);
      if (!nums) { skipped++; continue; }

      const detail = nums.map((n) => {
        if (suppressedSet.has(n)) {
          return { number: n, role: `${roles.get(n) || 'Number'} (our do-not-call list)`, result: 'listed' };
        }
        const verdict = verdicts.get(n);
        return {
          number: n,
          role: roles.get(n) || '',
          result: verdict === 'safe' || verdict === 'listed' ? verdict : 'unavailable',
        };
      });

      const anyListed = detail.some((d) => d.result === 'listed');
      const allSafe = detail.every((d) => d.result === 'safe');
      // A safe verdict is only usable while the provider's validity window holds.
      let status = anyListed ? 'listed' : allSafe && usableUntil ? 'safe' : 'unavailable';

      if (status === 'safe') safe++;
      else if (status === 'listed') listed++;
      else unavailable++;

      updates.push({
        id: p.id,
        tps_ctps_status: status,
        tps_ctps_results: detail,
        tps_ctps_checked_at: now,
        tps_ctps_reference: reference,
        tps_ctps_valid_until: usableUntil || null,
      });
    }

    for (let i = 0; i < updates.length; i += 500) {
      await base44.asServiceRole.entities.Prospect.bulkUpdate(updates.slice(i, i + 500));
    }

    // Per-number verdicts, so a caller can see which of a person's numbers is clear.
    if (phoneRecords?.length) {
      const phoneUpdates = [];
      for (const row of phoneRecords) {
        if (!targetIds.has(row.prospect_id) || !row.normalised) continue;
        if (row.country === 'IE') {
          phoneUpdates.push({
            id: row.id,
            screening_status: 'not_applicable',
            screening_checked_at: now,
            screening_reference: '',
            screening_valid_until: null,
          });
          continue;
        }
        const number = normaliseUkNumber(row.normalised);
        if (!number) continue;
        const verdict = suppressedSet.has(number) ? 'listed' : verdicts.get(number);
        phoneUpdates.push({
          id: row.id,
          screening_status: verdict === 'safe' || verdict === 'listed' ? verdict : 'unavailable',
          screening_checked_at: now,
          screening_reference: reference,
          screening_valid_until: usableUntil || null,
        });
      }
      for (let i = 0; i < phoneUpdates.length; i += 500) {
        await base44.asServiceRole.entities.ContactPhone.bulkUpdate(phoneUpdates.slice(i, i + 500));
      }
    }

    return Response.json({
      checked: updates.length,
      safe,
      listed,
      unavailable,
      skipped,
      suppressed: suppressedSet.size,
      reference,
      valid_until: usableUntil || null,
      credits_used: creditsUsed,
      key_source: resolved.source,
    });
  } catch (error) {
    console.error('screenProspectsTps failed', error?.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}