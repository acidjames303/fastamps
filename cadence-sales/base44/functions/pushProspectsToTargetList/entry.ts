import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { clean, digitsWithPlus as digits, domainKey, nameKeySimple as nameKey, escapeRegex } from '../../shared/textKeys.ts';

// Push a chunk of prospects into a campaign/target list in as few round trips as
// possible: one lookup per record type, then bulk writes. Pushing the same
// prospect again fills gaps instead of creating duplicates.

const MAX_PER_CALL = 25;
const WRITE_CHUNK = 100;

// Existing companies are matched case-insensitively on name and domain, so a
// prospect arriving as "MODA LIVING LIMITED" reuses the stored
// "Moda Living Limited" instead of creating a second record for the same company.
const matchPatterns = (values, field) => values
  .map((value) => clean(value))
  .filter(Boolean)
  .map((value) => ({ [field]: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } }));

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Everyone we can actually dial at a pushed company.
function dialablePeople(prospect) {
  const companyNumber = clean(prospect.phone) || clean(prospect.landline);
  const people = (prospect.contacts || [])
    .filter((c) => c && clean(c.name))
    .map((c) => ({
      name: clean(c.name),
      title: clean(c.title),
      phone: clean(c.phone) || companyNumber,
      email: clean(c.email),
      linkedin: clean(c.linkedin),
    }));

  if (!people.length && clean(prospect.full_name)) {
    people.push({
      name: clean(prospect.full_name),
      title: clean(prospect.job_title),
      phone: clean(prospect.phone) || companyNumber,
      email: clean(prospect.email),
      linkedin: clean(prospect.linkedin),
    });
  }

  if (!people.length && digits(companyNumber)) {
    people.push({
      name: clean(prospect.company_name),
      title: 'Main switchboard',
      phone: companyNumber,
      email: clean(prospect.generic_email) || clean(prospect.email),
      linkedin: '',
    });
  }

  return people;
}

export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'You do not have permission to push prospects.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const target_list_id = body?.target_list_id;
    const prospect_ids = [...new Set(Array.isArray(body?.prospect_ids) ? body.prospect_ids.filter(Boolean) : [])]
      .slice(0, MAX_PER_CALL);
    if (!target_list_id) return Response.json({ error: 'target_list_id required' }, { status: 400 });
    if (!prospect_ids.length) return Response.json({ error: 'prospect_ids required' }, { status: 400 });

    await assertListOwned(base44, org, target_list_id);

    const svc = base44.asServiceRole.entities;

    const prospects = await svc.Prospect.filter(
      { organisation_id: org.id, id: { $in: prospect_ids } }, '-created_date', MAX_PER_CALL,
    );
    if (!prospects.length) {
      return Response.json({ ok: true, pushed: 0, companies_created: 0, contacts_created: 0, contacts_updated: 0, members_added: 0 });
    }

    const domainValues = [...new Set(prospects.flatMap((p) => [
      clean(p.domain), clean(p.domain).toLowerCase(), domainKey(p.domain),
    ]).filter(Boolean))];
    const nameValues = [...new Set(prospects.map((p) => clean(p.company_name)).filter(Boolean))];

    const loadCompanies = async () => {
      const patterns = [
        ...matchPatterns(nameValues, 'name'),
        ...matchPatterns([...domainValues, ...domainValues.map(domainKey)], 'domain'),
      ];
      const found = patterns.length
        ? await svc.Company.filter({ organisation_id: org.id, $or: patterns }, '-created_date', 400).catch(() => [])
        : [];
      const byDomainMap = new Map();
      const byNameMap = new Map();
      const preferOldest = (map, key, company) => {
        const prev = map.get(key);
        if (!prev || String(company.created_date) < String(prev.created_date)) map.set(key, company);
      };
      found.forEach((c) => {
        if (clean(c.domain)) preferOldest(byDomainMap, domainKey(c.domain), c);
        if (clean(c.name)) preferOldest(byNameMap, nameKey(c.name), c);
      });
      return { byDomainMap, byNameMap };
    };

    let { byDomainMap, byNameMap } = await loadCompanies();

    // 1. Create the companies we don't hold yet, in one write.
    const missingCompanies = [];
    const seenNames = new Set();
    prospects.forEach((p) => {
      const existing = byDomainMap.get(domainKey(p.domain)) || byNameMap.get(nameKey(p.company_name));
      if (existing || seenNames.has(nameKey(p.company_name))) return;
      seenNames.add(nameKey(p.company_name));
      missingCompanies.push({
        name: p.company_name,
        domain: p.domain || '',
        website: p.website || '',
        industry: p.industry || '',
        employee_range: p.employee_range || '',
        location: p.location || '',
        landline: p.landline || p.phone || '',
        organisation_id: org.id,
        owner_user_id: user.id,
      });
    });
    const companyFor = (p) => byDomainMap.get(domainKey(p.domain)) || byNameMap.get(nameKey(p.company_name)) || null;

    if (missingCompanies.length) {
      for (const part of chunks(missingCompanies, WRITE_CHUNK)) {
        await svc.Company.bulkCreate(part);
      }
      ({ byDomainMap, byNameMap } = await loadCompanies());
    }

    // A bulk write can drop rows without raising. Write any company that still
    // has no record individually, so a prospect is never marked as pushed while
    // its company, contacts and list membership were silently skipped.
    for (const candidate of missingCompanies) {
      const prospect = prospects.find((p) => nameKey(p.company_name) === nameKey(candidate.name));
      if (!prospect || companyFor(prospect)) continue;
      await svc.Company.create(candidate).catch(() => {});
    }
    if (prospects.some((p) => !companyFor(p))) ({ byDomainMap, byNameMap } = await loadCompanies());

    const companyIds = [...new Set(prospects.map(companyFor).filter(Boolean).map((c) => c.id))];

    // 2. Everything we need to know about those companies, in one pass.
    const [contacts, members, intel, research] = await Promise.all([
      companyIds.length
        ? svc.Contact.filter({ organisation_id: org.id, company_id: { $in: companyIds } }, '-updated_date', 500).catch(() => [])
        : [],
      svc.TargetListMember.filter({ organisation_id: org.id, target_list_id }, '-created_date', 500).catch(() => []),
      companyIds.length
        ? svc.CompanyIntelligence.filter({ organisation_id: org.id, company_id: { $in: companyIds } }, '-generated_at', 200).catch(() => [])
        : [],
      svc.AccountResearch.filter({ organisation_id: org.id, prospect_id: { $in: prospect_ids } }, '-researched_at', 100).catch(() => []),
    ]);

    const contactByEmail = new Map();
    const contactByCompanyName = new Map();
    contacts.forEach((c) => {
      if (clean(c.email)) contactByEmail.set(nameKey(c.email), c);
      contactByCompanyName.set(`${c.company_id}|${nameKey(c.full_name)}`, c);
    });

    const memberCompanyIds = new Set(members.map((m) => m.company_id));
    const intelCompanyIds = new Set(intel.map((i) => i.company_id));
    const researchByProspect = new Map(research.map((r) => [r.prospect_id, r]));

    const contactsToCreate = [];
    const contactPatches = new Map();
    const membersToCreate = [];
    const intelToCreate = [];
    const companyPatches = new Map();
    const seenPeople = new Set();

    prospects.forEach((p) => {
      const company = companyFor(p);
      if (!company) return;

      if (!clean(company.landline) && (clean(p.landline) || clean(p.phone))) {
        companyPatches.set(company.id, { id: company.id, landline: clean(p.landline) || clean(p.phone) });
      }

      dialablePeople(p).forEach((person) => {
        const personKey = person.email ? `e:${nameKey(person.email)}` : `n:${company.id}|${nameKey(person.name)}`;
        if (seenPeople.has(personKey)) return;
        seenPeople.add(personKey);

        const existing = (person.email && contactByEmail.get(nameKey(person.email)))
          || contactByCompanyName.get(`${company.id}|${nameKey(person.name)}`);

        if (existing) {
          const patch = contactPatches.get(existing.id) || { id: existing.id };
          if (!clean(existing.job_title) && person.title) patch.job_title = person.title;
          if (!digits(existing.phone) && digits(person.phone)) patch.phone = person.phone;
          if (!clean(existing.email) && person.email) patch.email = person.email;
          if (!clean(existing.linkedin) && person.linkedin) patch.linkedin = person.linkedin;
          if (Object.keys(patch).length > 1) contactPatches.set(existing.id, patch);
          return;
        }

        contactsToCreate.push({
          full_name: person.name,
          job_title: person.title,
          company: p.company_name,
          company_id: company.id,
          phone: person.phone,
          email: person.email,
          linkedin: person.linkedin,
          industry: p.industry || '',
          employee_range: p.employee_range || '',
          source: p.provider_used || '',
          campaign_id: target_list_id,
          organisation_id: org.id,
          owner_user_id: user.id,
        });
      });

      if (!memberCompanyIds.has(company.id)) {
        memberCompanyIds.add(company.id);
        membersToCreate.push({
          target_list_id,
          company_id: company.id,
          organisation_id: org.id,
          owner_user_id: user.id,
        });
      }

      // Research gathered during prospecting becomes the dialer's brief.
      if (!intelCompanyIds.has(company.id)) {
        const r = researchByProspect.get(p.id);
        const findings = (r?.findings || []).filter((f) => clean(f.label) && clean(f.value));
        const summary = clean(r?.summary);
        if (findings.length || summary) {
          intelCompanyIds.add(company.id);
          const stamp = r.researched_at || new Date().toISOString();
          intelToCreate.push({
            company_id: company.id,
            company_name: company.name,
            canonical_key: clean(company.domain) || company.name,
            ai_summary: JSON.stringify({
              summary,
              what_they_do: findings.map((f) => `${clean(f.label)} — ${clean(f.value)}`),
              who_they_target: [],
            }),
            target_roles: r.target_roles || [],
            source: 'ai_web',
            status: 'current',
            confidence: 80,
            researched_at: stamp,
            generated_at: stamp,
            organisation_id: org.id,
          });
        }
      }
    });

    // 3. Write everything in bulk, a few calls at a time.
    const writes = [
      ...chunks(contactsToCreate, WRITE_CHUNK).map((part) => () => svc.Contact.bulkCreate(part)),
      ...chunks([...contactPatches.values()], WRITE_CHUNK).map((part) => () => svc.Contact.bulkUpdate(part)),
      ...chunks(membersToCreate, WRITE_CHUNK).map((part) => () => svc.TargetListMember.bulkCreate(part)),
      ...chunks(intelToCreate, 50).map((part) => () => svc.CompanyIntelligence.bulkCreate(part)),
      ...chunks([...companyPatches.values()], WRITE_CHUNK).map((part) => () => svc.Company.bulkUpdate(part)),
    ];
    for (const group of chunks(writes, 6)) {
      await Promise.allSettled(group.map((run) => run()));
    }

    // Only a prospect that resolved to a real company counts as pushed.
    const pushed = prospects.filter((p) => companyFor(p)).map((p) => p.id);
    const unresolved = prospects.filter((p) => !companyFor(p)).map((p) => p.company_name);
    for (const part of chunks(pushed.map((id) => ({ id, pushed: true })), WRITE_CHUNK)) {
      await svc.Prospect.bulkUpdate(part).catch(() => {});
    }

    return Response.json({
      ok: true,
      pushed: pushed.length,
      unresolved,
      companies_created: missingCompanies.length,
      contacts_created: contactsToCreate.length,
      contacts_updated: contactPatches.size,
      members_added: membersToCreate.length,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}