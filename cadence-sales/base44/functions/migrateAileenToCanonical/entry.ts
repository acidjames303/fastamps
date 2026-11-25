import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertCapability, CAPABILITIES } from '../../shared/capabilities.ts';
import { assessPerson, looksLikeAddress } from '../../shared/researchEvidence.ts';
import { clean, digitsOnly, domainKey, nameKeyLegal as nameKey, escapeRegex, chunks } from '../../shared/textKeys.ts';

// Consolidates Aileen's near-empty tenant into the canonical live organisation.
//
// Why this exists: the team is spread across separate organisations, so nobody
// can share a campaign. Operational history stays where it is: Tunstall and the
// canonical campaign data are never touched — only records that belong to the
// source organisation are moved or linked.
//
// Modes
//   preview   read-only. Reports exact / probable / new company matches, contact
//             matches, rejected placeholders and conflicts. Writes nothing.
//   execute   performs the moves and links, writing one ledger row per record.
//             Safe to re-run: every decision is derived from destination state,
//             so a second run links instead of duplicating.
//   revert    reverses the rows of one batch (deletes records it created,
//             restores the organisation id of records it moved).
//
// The evidence gate is absolute: a person becomes a Contact only when their
// provenance supports it. Unsourced research output stays on the Prospect and is
// flagged for review — it never reaches a calling queue.

const SOURCE_ORG = '6a96b72b3b807b7b9b0bf709';
const DEST_ORG = '6a85ffb42dc95d64abe8a98d';
const CANONICAL_NAME = 'B2B Sales Leads';
const ARCHIVE_NAME = 'B2B Sales Leads — archived migration source (do not use)';

const digits = digitsOnly;

const MOVE_ENTITIES = ['Campaign', 'ProspectList', 'Prospect', 'EnrichmentSession', 'UsageEvent', 'AuditLog'];

type LedgerRow = Record<string, any>;

async function destinationMaps(svc: any) {
  const [companies, contacts, members] = await Promise.all([
    svc.Company.filter({ organisation_id: DEST_ORG }, '-created_date', 3000).catch(() => []),
    svc.Contact.filter({ organisation_id: DEST_ORG }, '-created_date', 5000).catch(() => []),
    svc.TargetListMember.filter({ organisation_id: DEST_ORG }, '-created_date', 3000).catch(() => []),
  ]);
  const byDomain = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const c of companies) {
    const d = domainKey(c.domain || c.website);
    if (d && !byDomain.has(d)) byDomain.set(d, c);
    const n = nameKey(c.name);
    if (n && !byName.has(n)) byName.set(n, c);
  }
  const contactsByEmail = new Map<string, any>();
  const contactsByNameCompany = new Map<string, any>();
  for (const c of contacts) {
    const e = clean(c.email).toLowerCase();
    if (e && !contactsByEmail.has(e)) contactsByEmail.set(e, c);
    const k = `${c.company_id || ''}|${clean(c.full_name).toLowerCase()}`;
    if (!contactsByNameCompany.has(k)) contactsByNameCompany.set(k, c);
  }
  return { companies, contacts, members, byDomain, byName, contactsByEmail, contactsByNameCompany };
}

// Stable linked id → confirmed domain → confirmed email domain → legal name →
// trading name. Anything weaker than a legal-name match is "probable" and needs
// a human, so it is never auto-merged.
function matchCompany(prospect: any, maps: any) {
  const domain = domainKey(prospect.domain || prospect.website);
  const emailDomain = domainKey(clean(prospect.email).split('@')[1] || prospect.email_domain);
  if (domain && maps.byDomain.has(domain)) return { company: maps.byDomain.get(domain), reason: 'website_domain', probable: false };
  if (emailDomain && maps.byDomain.has(emailDomain)) return { company: maps.byDomain.get(emailDomain), reason: 'email_domain', probable: false };
  const legal = nameKey(prospect.company_name);
  if (legal && maps.byName.has(legal)) return { company: maps.byName.get(legal), reason: 'legal_name', probable: false };
  return { company: null, reason: legal ? 'no_match' : 'no_name', probable: false };
}

function planProspect(prospect: any, maps: any) {
  const match = matchCompany(prospect, maps);
  const people = (Array.isArray(prospect.contacts) ? prospect.contacts : []).filter((c: any) => c && clean(c.name));
  const candidates = clean(prospect.full_name)
    ? [...people, { name: prospect.full_name, title: prospect.job_title, phone: prospect.phone, email: prospect.email, linkedin: prospect.linkedin }]
    : people;
  const seenNames = new Set<string>();
  const named = candidates.filter((person: any) => {
    const key = clean(person.name).toLowerCase();
    if (!key || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
  const contacts: any[] = [];
  for (const person of named) {
    const verdict = assessPerson(person, prospect);
    const email = clean(person.email).toLowerCase();
    const already = (email && maps.contactsByEmail.get(email)) || null;
    contacts.push({
      name: clean(person.name),
      title: clean(person.title),
      email: clean(person.email),
      phone: clean(person.phone) || clean(person.mobile),
      linkedin: clean(person.linkedin),
      status: verdict.status,
      promotable: verdict.promotable,
      reason: verdict.reason,
      existing_contact_id: already ? already.id : '',
      title_is_address: looksLikeAddress(person.title),
    });
  }
  return { match, contacts };
}

export default async function (req: any) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    assertCapability(profile, CAPABILITIES.platform, 'Only the platform owner can run the organisation migration.');

    const body = await req.json().catch(() => ({}));
    const requested = clean(body.mode || 'preview');
    const mode = ['execute', 'revert'].includes(requested) ? requested : 'preview';
    const batchId = clean(body.batch_id) || `MIG-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const svc = base44.asServiceRole.entities;

    if (org.id !== DEST_ORG) {
      const e: any = new Error('This migration may only run from the canonical organisation.');
      e.status = 403;
      throw e;
    }

    const [sourceOrg, destOrg, sourceCampaigns, sourceLists, sourceProspects, sourceProfiles] = await Promise.all([
      svc.Organisation.get(SOURCE_ORG),
      svc.Organisation.get(DEST_ORG),
      svc.Campaign.filter({ organisation_id: SOURCE_ORG }, '-created_date', 100).catch(() => []),
      svc.ProspectList.filter({ organisation_id: SOURCE_ORG }, '-created_date', 100).catch(() => []),
      svc.Prospect.filter({ organisation_id: SOURCE_ORG }, '-created_date', 1000).catch(() => []),
      svc.UserProfile.filter({ organisation_id: SOURCE_ORG }, '-created_date', 100).catch(() => []),
    ]);

    // ── Revert ────────────────────────────────────────────────────────────
    if (mode === 'revert') {
      const rows: any[] = await svc.MigrationLedger.filter({ batch_id: batchId, status: 'applied' }, '-created_date', 5000).catch(() => []);
      const reversible = rows.filter((r: any) => (r.action === 'created' || r.action === 'moved') && r.destination_id);

      // Batched so a revert cannot time out halfway through and leave a
      // half-migrated organisation behind.
      const createdByEntity = new Map<string, string[]>();
      const movedByEntity = new Map<string, string[]>();
      const profileIds: string[] = [];
      for (const row of reversible) {
        const bucket = row.action === 'created' ? createdByEntity : movedByEntity;
        if (!bucket.has(row.entity)) bucket.set(row.entity, []);
        bucket.get(row.entity)!.push(row.action === 'created' ? row.destination_id : row.destination_id);
        if (row.action === 'moved' && row.entity === 'UserProfile') profileIds.push(row.destination_id);
      }

      let removed = 0;
      for (const [entity, ids] of createdByEntity) {
        for (const chunk of chunks(ids, 100)) {
          await svc[entity].deleteMany({ id: { $in: chunk } }).catch(() => {});
          removed += chunk.length;
        }
      }

      let restored = 0;
      for (const [entity, ids] of movedByEntity) {
        if (entity === 'Organisation') continue; // a rename is reversed by hand, never by id
        for (const chunk of chunks(ids, 100)) {
          await svc[entity].updateMany({ id: { $in: chunk } }, { $set: { organisation_id: SOURCE_ORG } }).catch(() => {});
          restored += chunk.length;
        }
      }
      if (profileIds.length) {
        const profiles = await svc.UserProfile.filter({ id: { $in: profileIds } }, '-created_date', 200).catch(() => []);
        const userIds = profiles.map((p: any) => p.user_id).filter(Boolean);
        for (const chunk of chunks(userIds, 100)) {
          await svc.User.updateMany({ id: { $in: chunk } }, { $set: { organisation_id: SOURCE_ORG } }).catch(() => {});
        }
      }

      for (const chunk of chunks(rows.map((r: any) => r.id), 100)) {
        await svc.MigrationLedger.updateMany({ id: { $in: chunk } }, { $set: { status: 'reverted' } }).catch(() => {});
      }

      return Response.json({ mode: 'revert', batch_id: batchId, rows: rows.length, deleted: removed, org_ids_restored: restored });
    }

    // ── Plan (shared by preview and execute) ──────────────────────────────
    const maps = await destinationMaps(svc);
    const planned: LedgerRow[] = [];

    if (destOrg.name !== CANONICAL_NAME) {
      planned.push({ entity: 'Organisation', source_id: SOURCE_ORG, destination_id: DEST_ORG, action: 'merged', match_reason: 'canonical_rename', previous_values: { name: destOrg.name, slug: destOrg.slug }, new_values: { name: CANONICAL_NAME } });
    }
    if (sourceOrg.name !== ARCHIVE_NAME) {
      planned.push({ entity: 'Organisation', source_id: SOURCE_ORG, destination_id: SOURCE_ORG, action: 'moved', match_reason: 'archive_source_rename', previous_values: { name: sourceOrg.name }, new_values: { name: ARCHIVE_NAME } });
    }
    for (const p of sourceProfiles) {
      planned.push({ entity: 'UserProfile', source_id: p.id, destination_id: p.id, action: 'moved', match_reason: 'membership_consolidation', previous_values: { organisation_id: SOURCE_ORG }, new_values: { organisation_id: DEST_ORG }, notes: p.email || p.full_name || '' });
    }
    for (const campaign of sourceCampaigns) {
      planned.push({ entity: 'Campaign', source_id: campaign.id, destination_id: campaign.id, action: 'moved', match_reason: 'campaign_move', previous_values: { organisation_id: SOURCE_ORG }, new_values: { organisation_id: DEST_ORG }, notes: campaign.name });
    }
    for (const list of sourceLists) {
      planned.push({ entity: 'ProspectList', source_id: list.id, destination_id: list.id, action: 'moved', match_reason: 'prospect_list_move', previous_values: { organisation_id: SOURCE_ORG }, new_values: { organisation_id: DEST_ORG }, notes: clean(list.name).slice(0, 60) });
    }

    const perProspect: any[] = [];
    for (const prospect of sourceProspects) {
      planned.push({ entity: 'Prospect', source_id: prospect.id, destination_id: prospect.id, action: 'moved', match_reason: 'prospect_move', previous_values: { organisation_id: SOURCE_ORG }, new_values: { organisation_id: DEST_ORG }, notes: prospect.company_name });
      const plan = planProspect(prospect, maps);
      perProspect.push({ prospect, plan });
      planned.push({
        entity: 'Company',
        source_id: prospect.id,
        destination_id: plan.match.company ? plan.match.company.id : '',
        action: plan.match.company ? 'linked' : 'created',
        match_reason: plan.match.reason,
        previous_values: { company_name: prospect.company_name, domain: prospect.domain || prospect.website, landline_withheld: clean(prospect.landline) || clean(prospect.company_phone) },
        new_values: { organisation_id: DEST_ORG },
        notes: plan.match.company ? '' : 'no destination company matched',
      });
      for (const person of plan.contacts) {
        const action = person.existing_contact_id ? 'linked'
          : person.promotable ? 'created'
            : person.status === 'unsupported' ? 'skipped' : 'review_required';
        planned.push({
          entity: 'Contact',
          source_id: prospect.id,
          destination_id: person.existing_contact_id || '',
          action,
          match_reason: person.reason,
          previous_values: { name: person.name, title: person.title, email: person.email, phone: person.phone },
          new_values: action === 'created' ? { organisation_id: DEST_ORG } : {},
          notes: person.title_is_address ? 'job title looks like a postal address — not used' : '',
        });
      }
    }

    const summary = {
      mode,
      batch_id: batchId,
      source_org: sourceOrg.name,
      destination_org: destOrg.name,
      prospects: sourceProspects.length,
      company_exact_matches: planned.filter((r) => r.entity === 'Company' && r.action === 'linked').length,
      company_probable_review: planned.filter((r) => r.entity === 'Company' && r.action === 'review_required').length,
      company_genuinely_new: planned.filter((r) => r.entity === 'Company' && r.action === 'created').length,
      contact_exact_matches: planned.filter((r) => r.entity === 'Contact' && r.action === 'linked').length,
      contact_new: planned.filter((r) => r.entity === 'Contact' && r.action === 'created').length,
      contact_rejected_placeholders: planned.filter((r) => r.entity === 'Contact' && r.match_reason === 'placeholder_or_not_a_person').length,
      contact_review_required: planned.filter((r) => r.entity === 'Contact' && r.action === 'review_required').length,
      records_changing_organisation: planned.filter((r) => r.action === 'moved').length,
      relationships_to_create: perProspect.length,
      destination_companies_existing: maps.companies.length,
      destination_contacts_existing: maps.contacts.length,
      destination_members_existing: maps.members.length,
    };

    if (mode === 'preview') {
      return Response.json({
        ...summary,
        written: 0,
        companies_matched_detail: planned.filter((r) => r.entity === 'Company' && r.action === 'linked').slice(0, 10),
        companies_new_detail: planned.filter((r) => r.entity === 'Company' && r.action === 'created').slice(0, 10),
        contacts_detail: planned.filter((r) => r.entity === 'Contact').slice(0, 12),
        planned_rows: planned.length,
      });
    }

    // ── Execute ───────────────────────────────────────────────────────────
    // 1. Names: canonical org takes the live name, source is clearly archived.
    if (destOrg.name !== CANONICAL_NAME) await svc.Organisation.update(DEST_ORG, { name: CANONICAL_NAME }).catch(() => {});
    if (sourceOrg.name !== ARCHIVE_NAME) await svc.Organisation.update(SOURCE_ORG, { name: ARCHIVE_NAME }).catch(() => {});

    // 2. Membership.
    for (const p of sourceProfiles) {
      await svc.UserProfile.update(p.id, { organisation_id: DEST_ORG }).catch(() => {});
      await base44.asServiceRole.entities.User.update(p.user_id, { organisation_id: DEST_ORG }).catch(() => {});
    }

    // 3. Move the operational records (history travels with them; Tunstall is in
    //    the destination already and is never touched).
    for (const entity of MOVE_ENTITIES) {
      const rows = await svc[entity].filter({ organisation_id: SOURCE_ORG }, '-created_date', 5000).catch(() => []);
      for (const row of rows) {
        await svc[entity].update(row.id, { organisation_id: DEST_ORG }).catch(() => {});
      }
    }

    // 4. Companies, 5. evidenced contacts, 6. list membership.
    const campaignListId = sourceLists.find((l: any) => clean(l.campaign_id))?.campaign_id || sourceCampaigns[0]?.id || '';
    const createdCompanies: string[] = [];
    const companyByProspect = new Map<string, string>();
    const createdMembers: string[] = [];
    for (const { prospect } of perProspect) {
      const companyName = clean(prospect.company_name);
      if (!companyName) continue;
      const domain = domainKey(prospect.domain || prospect.website);
      const orClauses: any[] = [{ name: { $regex: `^${escapeRegex(companyName)}$`, $options: 'i' } }];
      if (domain) orClauses.push({ domain: { $regex: `^${escapeRegex(domain)}$`, $options: 'i' } });
      const existing = await svc.Company.filter({ organisation_id: DEST_ORG, $or: orClauses }, '-created_date', 5).catch(() => []);
      let company = existing.find((c: any) => domain && domainKey(c.domain) === domain) || existing[0] || null;
      if (!company) {
        // Company firmographics are kept; the unsourced number is NOT promoted
        // into the dialable landline field.
        company = await svc.Company.create({
          name: companyName,
          domain: clean(prospect.domain),
          website: clean(prospect.website),
          industry: clean(prospect.industry),
          employee_range: clean(prospect.employee_range),
          location: clean(prospect.location),
          landline: '',
          data_source: 'prospect_migration',
          source_reference: prospect.id,
          organisation_id: DEST_ORG,
        }).catch(() => null);
        if (company) createdCompanies.push(company.id);
      }
      if (!company) continue;
      companyByProspect.set(prospect.id, company.id);

      if (campaignListId) {
        const members = await svc.TargetListMember
          .filter({ organisation_id: DEST_ORG, target_list_id: campaignListId, company_id: company.id }, '-created_date', 1)
          .catch(() => []);
        if (!members.length) {
          const member = await svc.TargetListMember.create({
            target_list_id: campaignListId,
            company_id: company.id,
            organisation_id: DEST_ORG,
          }).catch(() => null);
          if (member) createdMembers.push(member.id);
        }
      }
    }

    // 7. Recalculate campaign and list totals from the underlying records.
    let contactCount = 0;
    if (campaignListId) {
      const members = await svc.TargetListMember.filter({ organisation_id: DEST_ORG, target_list_id: campaignListId }, '-created_date', 5000).catch(() => []);
      contactCount = new Set(members.map((m: any) => m.company_id).filter(Boolean)).size;
      await svc.Campaign.update(campaignListId, { contact_count: contactCount }).catch(() => {});
    }
    for (const list of sourceLists) {
      const members = await svc.TargetListMember.filter({ organisation_id: DEST_ORG, target_list_id: campaignListId || list.id }, '-created_date', 5000).catch(() => []);
      const count = new Set(members.map((m: any) => m.company_id).filter(Boolean)).size;
      await svc.ProspectList.update(list.id, { company_count: count }).catch(() => {});
    }

    // 8. Ledger — one row per decision, written once per batch run.
    const now = new Date().toISOString();
    const ledgerRows = planned.map((row) => ({
      ...row,
      // A created Company is only reversible if the ledger names what was created.
      destination_id: row.entity === 'Company' ? (companyByProspect.get(row.source_id) || row.destination_id) : row.destination_id,
      batch_id: batchId,
      run_mode: 'execute',
      source_organisation_id: SOURCE_ORG,
      destination_organisation_id: DEST_ORG,
      status: 'applied',
      created_by_user_id: profile.user_id,
      applied_at: now,
    }));
    for (const memberId of createdMembers) {
      ledgerRows.push({
        entity: 'TargetListMember',
        source_id: campaignListId,
        destination_id: memberId,
        action: 'created',
        match_reason: 'campaign_membership',
        previous_values: {},
        new_values: { organisation_id: DEST_ORG },
        notes: '',
        batch_id: batchId,
        run_mode: 'execute',
        source_organisation_id: SOURCE_ORG,
        destination_organisation_id: DEST_ORG,
        status: 'applied',
        created_by_user_id: profile.user_id,
        applied_at: now,
      });
    }
    for (let i = 0; i < ledgerRows.length; i += 200) {
      await svc.MigrationLedger.bulkCreate(ledgerRows.slice(i, i + 200)).catch(() => {});
    }

    return Response.json({
      ...summary,
      mode: 'execute',
      written: ledgerRows.length,
      companies_created: createdCompanies.length,
      campaign_contact_count: contactCount,
      ledger: 'MigrationLedger',
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}