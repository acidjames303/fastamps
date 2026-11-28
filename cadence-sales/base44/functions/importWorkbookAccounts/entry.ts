import { resolveTenant } from '../../shared/tenantAuth.ts';

// Importing a client workbook that was reviewed in Cadence.
//
// The browser does the reading, mapping and joining (src/lib/workbookPlan.js) and
// shows the counts to a person first. This function only writes, and it writes
// conservatively:
//   - the organisation and list are resolved server-side, never trusted from the body
//   - a record is only matched on an equal domain with an equal name, or an exact
//     company name — a shared domain never merges two differently named companies
//   - existing values are never overwritten; only blanks are filled
//   - every distinct phone number becomes its own ContactPhone candidate, so a
//     second or third number is kept rather than replacing the first
//   - the raw row, with workbook/sheet/row provenance, is kept in ImportRow
//   - re-running the same import creates no duplicates
// Nothing here calls a paid provider or sends anything.

const CAPABILITIES = ['prospecting', 'providers', 'calling'];
const MAX_ACCOUNTS = 500;

const normName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|the|group|holdings|uk)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');

function normDomain(value) {
  const text = String(value || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '');
  if (!text || !text.includes('.') || text.includes('@')) return '';
  return text;
}

const personKey = (contact) =>
  normName(`${contact?.first_name || ''} ${contact?.last_name || ''}`) ||
  normName(contact?.name) ||
  normName(contact?.email);

const text = (value) => String(value ?? '').trim();

function mapContact(contact, accountName) {
  const phones = Array.isArray(contact?.phones) ? contact.phones.filter((phone) => phone?.normalised) : [];
  const mobile = phones.find((phone) => phone.phone_type === 'mobile');
  const direct = phones.find((phone) => phone.phone_type === 'direct');
  const switchboard = phones.find((phone) => phone.phone_type === 'switchboard');
  return {
    name: text(contact?.name) || [text(contact?.first_name), text(contact?.last_name)].filter(Boolean).join(' '),
    first_name: text(contact?.first_name),
    last_name: text(contact?.last_name),
    person_key: personKey(contact),
    title: text(contact?.title),
    email: text(contact?.email),
    email_status: text(contact?.email_status) || (contact?.email ? 'provider_returned' : 'unknown'),
    email_source: contact?.email ? 'import' : '',
    linkedin: text(contact?.linkedin),
    phone: mobile?.value || direct?.value || switchboard?.value || '',
    mobile: mobile?.value || '',
    direct_dial: direct?.value || '',
    company_phone: switchboard?.value || '',
    phone_type: mobile ? 'mobile' : direct ? 'geographic' : switchboard ? 'switchboard' : 'unknown',
    phone_status: mobile || direct || switchboard ? 'provider_returned_unverified' : 'unknown',
    phone_source: mobile || direct || switchboard ? 'import' : '',
    source_url: text(contact?.source_url),
    notes: text(contact?.notes),
    original_account_name: text(contact?.original_account_name) || accountName,
    alias_target: text(contact?.alias_target),
    employment_check: 'unconfirmed',
    provenance: contact?.provenance || null,
  };
}

function accountPayload(account, listId, orgId, provenance) {
  const contacts = (account?.contacts || []).map((contact) => mapContact(contact, account.company_name));
  const first = contacts[0] || {};
  return {
    list_id: listId,
    company_name: text(account.company_name),
    domain: normDomain(account.domain || account.website),
    website: text(account.website) || (normDomain(account.domain) ? `https://${normDomain(account.domain)}` : ''),
    industry: text(account.market) || text(account.industry),
    generic_email: text(account.generic_email),
    contacts,
    full_name: first.name || '',
    job_title: first.title || '',
    email: first.email || '',
    phone: first.phone || '',
    mobile: first.mobile || '',
    direct_dial: first.direct_dial || '',
    company_phone: text(account.company_phone) || first.company_phone || '',
    phone_type: first.phone_type || 'unknown',
    phone_status: first.phone_status || 'unknown',
    phone_source: first.phone_source || '',
    enrichment_status: 'pending',
    fit_score: 0,
    geography_status: 'unknown',
    pushed: false,
    call_status: 'new',
    source: 'import',
    provider_used: 'import',
    organisation_id: orgId,
    field_provenance: provenance ? { import: provenance } : {},
  };
}

// Never overwrite: only blanks are filled, arrays only when empty.
function fillOnly(existing, patch) {
  const change = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '') continue;
    const current = existing?.[key];
    if (Array.isArray(value)) {
      if (!Array.isArray(current) || current.length === 0) change[key] = value;
      continue;
    }
    if (current === undefined || current === null || current === '') change[key] = value;
  }
  return change;
}

// Merge contacts by person key: existing people stay, blanks get filled, and a
// new person is appended rather than replacing anyone.
function mergeContacts(existing = [], incoming = []) {
  const merged = Array.isArray(existing) ? existing.map((contact) => ({ ...contact })) : [];
  let added = 0;
  for (const contact of incoming) {
    const key = contact.person_key || personKey(contact);
    if (!key) continue;
    const match = merged.find((item) => (item.person_key || personKey(item)) === key);
    if (match) {
      for (const [field, value] of Object.entries(contact)) {
        if (field === 'person_key') continue;
        if (value && !match[field]) match[field] = value;
      }
      continue;
    }
    merged.push({ ...contact, person_key: key });
    added += 1;
  }
  return { contacts: merged, added };
}

export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const permitted = CAPABILITIES.some((capability) => (profile?.capabilities || []).includes(capability));
    if (!permitted) {
      return Response.json({ error: 'Your role does not permit importing prospect lists.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const accounts = (Array.isArray(body?.accounts) ? body.accounts : [])
      .filter((account) => text(account?.company_name))
      .slice(0, MAX_ACCOUNTS);
    if (!accounts.length) {
      return Response.json({ error: 'No accounts were supplied to import.' }, { status: 400 });
    }

    let list = null;
    if (body?.list_id) {
      list = await base44.asServiceRole.entities.ProspectList.get(body.list_id)
        .catch((error) => (error.status === 404 ? null : Promise.reject(error)));
      if (!list || list.organisation_id !== org.id) {
        return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
      }
    } else {
      const name = text(body?.list_name) || 'Imported client list';
      list = await base44.asServiceRole.entities.ProspectList.create({
        name: name.slice(0, 120),
        brief: text(body?.brief) || `Accounts imported from ${(body?.workbooks || []).join(', ') || 'a client workbook'}`,
        status: 'ready',
        company_count: 0,
        permitted_countries: ['GB'],
        target_titles: Array.isArray(body?.target_roles) ? body.target_roles.slice(0, 25) : [],
        organisation_id: org.id,
        owner_user_id: user.id,
      });
    }

    const existing = await base44.asServiceRole.entities.Prospect
      .filter({ list_id: list.id }, '-created_date', 1000)
      .catch(() => []);
    const byDomainName = new Map();
    const byName = new Map();
    for (const prospect of existing || []) {
      const domain = normDomain(prospect.domain);
      const nameKey = normName(prospect.company_name);
      if (domain && nameKey) byDomainName.set(`${domain}::${nameKey}`, prospect);
      if (nameKey) byName.set(nameKey, prospect);
    }

    const createdAccounts = [];
    const updatedAccounts = [];
    const importRows = [];
    const phoneQueue = [];
    let contactsAdded = 0;

    for (const account of accounts) {
      const name = text(account.company_name);
      const nameKey = normName(name);
      const domain = normDomain(account.domain || account.website);
      const provenance = account?.provenance?.[0] || null;
      const payload = accountPayload(account, list.id, org.id, provenance);

      const match = (domain && nameKey ? byDomainName.get(`${domain}::${nameKey}`) : null) || (nameKey ? byName.get(nameKey) : null);

      let prospect = match;
      if (match) {
        const change = fillOnly(match, payload);
        const merged = mergeContacts(match.contacts, payload.contacts);
        contactsAdded += merged.added;
        const patch = { ...change, contacts: merged.contacts };
        if (payload.contacts.length && !Array.isArray(match.contacts)) patch.contacts = payload.contacts;
        delete patch.list_id;
        delete patch.organisation_id;
        prospect = await base44.asServiceRole.entities.Prospect.update(match.id, patch);
        updatedAccounts.push(prospect);
      } else {
        prospect = await base44.asServiceRole.entities.Prospect.create(payload);
        createdAccounts.push(prospect);
        contactsAdded += payload.contacts.length;
        if (domain && nameKey) byDomainName.set(`${domain}::${nameKey}`, prospect);
        if (nameKey) byName.set(nameKey, prospect);
      }

      importRows.push({
        entity: 'account',
        prospect_id: prospect.id,
        matched_by: match ? (domain ? 'domain' : 'name') : 'new',
        original_company_name: name,
        provenance,
        raw: account.raw || null,
        flags: [],
      });

      for (let index = 0; index < payload.contacts.length; index += 1) {
        const contact = payload.contacts[index];
        const sourcePhones = (account?.contacts || [])[index]?.phones || [];
        importRows.push({
          entity: 'contact',
          prospect_id: prospect.id,
          contact_key: contact.person_key,
          matched_by: contact.alias_target ? 'alias' : 'name',
          original_company_name: contact.original_account_name || name,
          provenance: contact.provenance,
          raw: null,
          flags: contact.alias_target ? ['alias_used'] : [],
        });
        for (const phone of sourcePhones) {
          phoneQueue.push({
            organisation_id: org.id,
            list_id: list.id,
            prospect_id: prospect.id,
            person_key: contact.person_key,
            person_name: contact.name,
            person_title: contact.title,
            value: text(phone.value),
            normalised: text(phone.normalised),
            country: text(phone.country) || 'GB',
            phone_type: text(phone.phone_type) || 'unknown',
            source: 'import',
            source_column: text(phone.source_column),
            status: 'candidate',
            screening_status: 'not_checked',
            retrieved_at: new Date().toISOString(),
          });
        }
      }
    }

    // Phone candidates: one row per distinct number, never a duplicate on re-import.
    const existingPhones = await base44.asServiceRole.entities.ContactPhone
      .filter({ list_id: list.id }, '-created_date', 1000)
      .catch(() => []);
    const seenPhones = new Set(
      (existingPhones || []).map((phone) => `${phone.prospect_id}:${phone.person_key}:${phone.country}:${phone.normalised}`),
    );
    const newPhones = [];
    for (const phone of phoneQueue) {
      const key = `${phone.prospect_id}:${phone.person_key}:${phone.country}:${phone.normalised}`;
      if (!phone.normalised || seenPhones.has(key)) continue;
      seenPhones.add(key);
      newPhones.push(phone);
    }
    for (let i = 0; i < newPhones.length; i += 100) {
      await base44.asServiceRole.entities.ContactPhone.bulkCreate(newPhones.slice(i, i + 100));
    }

    const batch = await base44.asServiceRole.entities.ImportBatch.create({
      organisation_id: org.id,
      list_id: list.id,
      batch_key: text(body?.batch_key),
      workbooks: Array.isArray(body?.workbooks) ? body.workbooks.slice(0, 20) : [],
      sheets: Array.isArray(body?.sheets) ? body.sheets.slice(0, 40) : [],
      counts: body?.counts || {},
      aliases: Array.isArray(body?.aliases) ? body.aliases.slice(0, 50) : [],
      target_roles: Array.isArray(body?.target_roles) ? body.target_roles.slice(0, 25) : [],
      role_instructions: text(body?.role_instructions).slice(0, 8000),
      enrichment_approved: Boolean(body?.enrichment_approved),
      approved_by_user_id: body?.enrichment_approved ? user.id : '',
      approved_at: body?.enrichment_approved ? new Date().toISOString() : null,
      status: 'imported',
      created_accounts: createdAccounts.length,
      updated_accounts: updatedAccounts.length,
      created_contacts: contactsAdded,
      created_phones: newPhones.length,
      created_by_user_id: user.id,
    });

    const rows = importRows
      .filter((row) => row.provenance?.workbook || row.raw)
      .slice(0, 2000)
      .map((row) => ({
        organisation_id: org.id,
        batch_id: batch.id,
        list_id: list.id,
        prospect_id: row.prospect_id,
        contact_key: row.contact_key || '',
        entity: row.entity,
        workbook: text(row.provenance?.workbook),
        sheet: text(row.provenance?.sheet),
        row_number: Number(row.provenance?.row) || 0,
        matched_by: row.matched_by,
        original_company_name: row.original_company_name,
        raw: row.raw || {},
        flags: row.flags,
        created_at: new Date().toISOString(),
      }));
    for (let i = 0; i < rows.length; i += 100) {
      await base44.asServiceRole.entities.ImportRow.bulkCreate(rows.slice(i, i + 100));
    }

    const totalAccounts = (existing?.length || 0) + createdAccounts.length;
    await base44.asServiceRole.entities.ProspectList.update(list.id, { company_count: totalAccounts }).catch(() => {});

    return Response.json({
      ok: true,
      batch_id: batch.id,
      list_id: list.id,
      accounts_created: createdAccounts.length,
      accounts_updated: updatedAccounts.length,
      contacts_added: contactsAdded,
      phones_added: newPhones.length,
      provenance_rows: rows.length,
      total_accounts: totalAccounts,
      unmatched_contacts: Array.isArray(body?.unmatched_contacts) ? body.unmatched_contacts.length : 0,
      ambiguous: Array.isArray(body?.ambiguous) ? body.ambiguous.length : 0,
    });
  } catch (error) {
    console.error('importWorkbookAccounts failed', error?.message);
    return Response.json({ error: error?.message || 'The import could not be completed.' }, { status: error?.status || 500 });
  }
}