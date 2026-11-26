// Keeps the live campaign in step with enrichment.
//
// Enrichment happens against a Prospect record, but the dialler, campaign page
// and CSV export all read Company / Contact / TargetListMember. Without this
// step an enriched mobile number sits on the prospect and never reaches the
// campaign until somebody presses a separate "push" button.
//
// Rules: never overwrite an existing value, never create a duplicate company or
// contact, and never move a prospect to a different list or campaign.
//
// Evidence gate: research output becomes a Contact (or reaches a callable field)
// only when its provenance supports it. Unsupported people and numbers stay on
// the Prospect and are flagged for review instead of entering a calling queue.
import { assessPerson, assessNumber } from './researchEvidence.ts';

const clean = (value: any) => String(value ?? '').trim();
const digits = (value: any) => clean(value).replace(/[^\d+]/g, '');const domainKey = (value: any) => clean(value).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
const nameKey = (value: any) => clean(value).toLowerCase().replace(/\s+/g, ' ');
const escapeRegex = (value: string) => clean(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Deterministic: only a 07 / +447 number may be called a mobile on a campaign.
const isMobileNumber = (value: any) => {
  let d = clean(value).replace(/[^\d+]/g, '');
  if (d.startsWith('0044')) d = '+' + d.slice(4);
  if (d.startsWith('0')) d = '+44' + d.slice(1);
  if (d.startsWith('44')) d = '+' + d;
  return /^\+447[1-57-9]\d{8}$/.test(d);
};

// The list the campaign actually works: ProspectList → Campaign, falling back to
// the list id itself when it already is a campaign/target list.
export async function resolveCampaignListId(base44: any, org: any, prospect: any): Promise<string> {
  const svc = base44.asServiceRole.entities;
  if (prospect?.list_id) {
    const list = await svc.ProspectList.get(prospect.list_id).catch(() => null);
    if (list && list.organisation_id === org.id && clean(list.campaign_id)) return clean(list.campaign_id);
    const asCampaign = await svc.Campaign.get(prospect.list_id).catch(() => null);
    if (asCampaign && asCampaign.organisation_id === org.id) return asCampaign.id;
  }
  return '';
}

// Mirrors an enriched prospect into its campaign: company, contacts and list
// membership. Returns counts so the caller can report what changed.
export async function syncProspectToCampaign(base44: any, org: any, prospect: any) {
  const svc = base44.asServiceRole.entities;
  const result = { company_id: '', contacts_created: 0, contacts_updated: 0, contacts_withheld: 0, member_added: false, skipped: '' };

  if (!prospect?.company_name) {
    result.skipped = 'prospect has no company name';
    return result;
  }

  const domain = domainKey(prospect.domain || prospect.website);
  const companyName = clean(prospect.company_name);

  // 1. Find the existing company in this organisation, by domain or name.
  const or = [];
  if (companyName) or.push({ name: { $regex: `^${escapeRegex(companyName)}$`, $options: 'i' } });
  if (domain) or.push({ domain: { $regex: `^${escapeRegex(domain)}$`, $options: 'i' } });
  const matches = or.length
    ? await svc.Company.filter({ organisation_id: org.id, $or: or }, '-created_date', 20).catch(() => [])
    : [];
  let company = matches.find((c: any) => domain && domainKey(c.domain) === domain)
    || matches.find((c: any) => nameKey(c.name) === nameKey(companyName))
    || null;

  // 2. Create it only when the prospect actually has something worth calling.
  if (!company) {
    const landline = clean(prospect.landline) || clean(prospect.phone);
    if (!domain && !landline) {
      result.skipped = 'no domain or number to place in the campaign yet';
      return result;
    }
    company = await svc.Company.create({
      name: companyName,
      domain: prospect.domain || '',
      website: prospect.website || '',
      industry: prospect.industry || '',
      employee_range: prospect.employee_range || '',
      location: prospect.location || '',
      landline: clean(prospect.landline) || '',
      organisation_id: org.id,
    }).catch(() => null);
    if (!company) {
      result.skipped = 'company could not be created';
      return result;
    }
  } else {
    // Fill gaps only — a stored switchboard or domain is never replaced.
    const patch: any = {};
    if (!clean(company.domain) && prospect.domain) patch.domain = prospect.domain;
    if (!clean(company.website) && prospect.website) patch.website = prospect.website;
    if (!clean(company.industry) && prospect.industry) patch.industry = prospect.industry;
    if (!clean(company.employee_range) && prospect.employee_range) patch.employee_range = prospect.employee_range;
    if (!clean(company.location) && prospect.location) patch.location = prospect.location;
    if (!clean(company.landline) && clean(prospect.landline)) patch.landline = clean(prospect.landline);
    if (Object.keys(patch).length) {
      company = { ...company, ...patch };
      await svc.Company.update(company.id, patch).catch(() => {});
    }
  }
  result.company_id = company.id;

  // 3. People to place against the company.
  const people = (prospect.contacts || [])
    .filter((c: any) => c && clean(c.name))
    .map((c: any) => {
      const verdict = assessPerson(c, prospect);
      return {
        name: clean(c.name), title: clean(c.title), phone: clean(c.phone),
        email: clean(c.email), linkedin: clean(c.linkedin),
        mobile: clean(c.mobile), directDial: clean(c.direct_dial),
        lushaMobile: clean(c.lusha_mobile), lushaPhoneStatus: clean(c.lusha_phone_status),
        phoneSource: clean(c.phone_source),
        phoneType: clean(c.phone_type), phoneStatus: clean(c.phone_status),
        confidence: Number(c.phone_confidence || 0), reviewReason: clean(c.phone_review_reason),
        verdict,
      };
    });
  if (!people.length && clean(prospect.full_name)) {
    people.push({
      name: clean(prospect.full_name), title: clean(prospect.job_title),
      phone: clean(prospect.phone), email: clean(prospect.email), linkedin: clean(prospect.linkedin),
      mobile: clean(prospect.mobile), directDial: clean(prospect.direct_dial),
      lushaMobile: clean(prospect.lusha_mobile), lushaPhoneStatus: clean(prospect.lusha_phone_status),
      phoneSource: clean(prospect.phone_source),
      verdict: assessPerson({ name: prospect.full_name, phone: prospect.phone, email: prospect.email }, prospect),
    });
  }
  // Only evidenced people with something to dial may enter the campaign.
  const dialable = people
    .filter((p: any) => (digits(p.phone) || p.email) && p.verdict.promotable)
    .slice(0, 5);
  result.contacts_withheld = people.filter((p: any) => !p.verdict.promotable).length;
  if (!dialable.length) {
    const board = clean(prospect.landline) || clean(prospect.phone);
    const boardVerdict = assessNumber(board, prospect.phone_source || prospect.provider_used);
    if (digits(board) && boardVerdict.callable) {
      dialable.push({ name: companyName, title: 'Main switchboard', phone: board, email: '', linkedin: '' });
    }
  }

  const existingContacts = await svc.Contact.filter({ organisation_id: org.id, company_id: company.id }, '-updated_date', 200).catch(() => []);
  const contactByName = new Map<string, any>();
  for (const c of existingContacts) contactByName.set(nameKey(c.full_name), c);
  const campaignListId = await resolveCampaignListId(base44, org, prospect);

  for (const person of dialable) {
    const existing = contactByName.get(nameKey(person.name));
    if (existing) {
      const patch: any = {};
      // A stored company switchboard is not this person's number: a revealed
      // direct/mobile number must replace it so the dialler uses the real line.
      const incomingDigits = digits(person.phone);
      const storedDigits = digits(existing.phone);
      const boardDigits = digits(company.landline) || digits(prospect.landline);
      const storedIsSwitchboard = !!storedDigits && !!boardDigits && storedDigits === boardDigits;
      const shouldSetPhone = !!incomingDigits &&
        (!storedDigits || (storedIsSwitchboard && incomingDigits !== boardDigits));
      if (shouldSetPhone) {
        patch.phone = person.phone;
        // Provider-returned data is never marked "good" automatically. It is
        // labelled unverified until a human or an independent check confirms it.
        patch.number_status = 'untested';
        patch.phone_status = person.phoneStatus || prospect.phone_status || 'provider_returned_unverified';
        patch.phone_type = person.phoneType || prospect.phone_type || (isMobileNumber(person.phone) ? 'mobile' : 'unknown');
        patch.phone_source = prospect.phone_source || prospect.provider_used || 'enrichment';
        patch.phone_confidence = person.confidence || prospect.phone_confidence || 0;
        patch.phone_review_reason = person.reviewReason || prospect.phone_review_reason || '';
        patch.phone_retrieved_at = prospect.phone_retrieved_at || new Date().toISOString();
        if (isMobileNumber(person.phone)) patch.mobile = person.phone;
      }
      if (!clean(existing.direct_dial) && person.directDial) patch.direct_dial = person.directDial;
      if (!clean(existing.mobile) && person.mobile && isMobileNumber(person.mobile)) patch.mobile = person.mobile;
      if (!clean(existing.lusha_mobile) && clean(person.lushaMobile || person.lusha_mobile)) {
        patch.lusha_mobile = clean(person.lushaMobile || person.lusha_mobile);
        if (person.lushaPhoneStatus) patch.lusha_phone_status = person.lushaPhoneStatus;
      }
      if (!clean(existing.phone_source) && (prospect.phone_source || person.phoneSource)) {
        patch.phone_source = prospect.phone_source || person.phoneSource;
      }
      if (!clean(existing.company_phone)) {
        const board = clean(company.landline) || clean(prospect.landline);
        if (board) patch.company_phone = board;
      }
      if (!clean(existing.email) && person.email) patch.email = person.email;
      if (!clean(existing.job_title) && person.title) patch.job_title = person.title;
      if (!clean(existing.linkedin) && person.linkedin) patch.linkedin = person.linkedin;
      if (Object.keys(patch).length) {
        await svc.Contact.update(existing.id, patch).catch(() => {});
        result.contacts_updated++;
      }
      continue;
    }
    const created = await svc.Contact.create({
      full_name: person.name,
      job_title: person.title || '',
      company: companyName,
      company_id: company.id,
      phone: person.phone || '',
      email: person.email || '',
      linkedin: person.linkedin || '',
      number_status: 'untested',
      phone_type: person.phoneType || prospect.phone_type || (isMobileNumber(person.phone) ? 'mobile' : 'unknown'),
      phone_status: person.phone ? (person.phoneStatus || prospect.phone_status || 'provider_returned_unverified') : 'unknown',
      phone_source: person.phoneSource || prospect.phone_source || prospect.provider_used || 'enrichment',
      phone_confidence: person.confidence || prospect.phone_confidence || 0,
      phone_review_reason: person.reviewReason || prospect.phone_review_reason || '',
      phone_retrieved_at: prospect.phone_retrieved_at || new Date().toISOString(),
      mobile: isMobileNumber(person.mobile || person.phone) ? (person.mobile || person.phone) : '',
      direct_dial: person.directDial || '',
      // Person-level only — never copy prospect.lusha_mobile onto every sibling.
      lusha_mobile: person.lushaMobile || '',
      lusha_phone_status: person.lushaPhoneStatus || '',
      company_phone: clean(company.landline) || clean(prospect.landline) || '',
      source: prospect.provider_used || 'enrichment',
      campaign_id: campaignListId || '',
      organisation_id: org.id,
    }).catch(() => null);
    if (created) {
      contactByName.set(nameKey(person.name), created);
      result.contacts_created++;
    }
  }

  // 4. Put the company on the campaign list the prospect belongs to.
  if (campaignListId) {
    const members = await svc.TargetListMember
      .filter({ organisation_id: org.id, target_list_id: campaignListId, company_id: company.id }, '-created_date', 1)
      .catch(() => []);
    if (!members.length) {
      const added = await svc.TargetListMember.create({
        target_list_id: campaignListId,
        company_id: company.id,
        organisation_id: org.id,
      }).catch(() => null);
      result.member_added = !!added;
    }
  }

  // 5. Keep the list count derived from the records, never a running tally.
  if (prospect.list_id) {
    const memberships = await svc.TargetListMember
      .filter({ organisation_id: org.id, target_list_id: campaignListId || prospect.list_id }, '-created_date', 500)
      .catch(() => []);
    const companyCount = new Set(memberships.map((m: any) => m.company_id).filter(Boolean)).size;
    await svc.ProspectList.update(prospect.list_id, { company_count: companyCount }).catch(() => {});
  }

  return result;
}