import { resolveTenant } from '../../shared/tenantAuth.ts';

// Accounts & notes for one campaign, for managers who read the work without dialling.
// Each account carries the people at it and the notes callers left on it, so a
// manager can read the history and gather the email addresses in one place.
const MAX_ROWS = 8000;
const MAX_CONTACTS_PER_ACCOUNT = 12;
const MAX_NOTES_PER_ACCOUNT = 6;

async function readAll(fetchPage: (opts: any) => Promise<any>) {
  const rows: any[] = [];
  let cursor: string | undefined;
  while (rows.length < MAX_ROWS) {
    const page = await fetchPage({ limit: 500, cursor });
    const items = page?.items || [];
    rows.push(...items);
    if (!page?.has_more || !page?.next_cursor || !items.length) break;
    cursor = page.next_cursor;
  }
  return rows;
}

export default async function (req) {
  try {
    const { base44, membership } = await resolveTenant(req);
    const svc = base44.asServiceRole.entities;
    const orgId = membership.organisation_id;

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaign_id;
    if (!campaignId) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

    const campaign = await svc.Campaign.get(campaignId).catch(() => null);
    if (!campaign || campaign.organisation_id !== orgId) {
      return Response.json({ error: 'Campaign not found for this organisation.' }, { status: 404 });
    }

    const [members, lists, companies, contacts, logs, profiles] = await Promise.all([
      readAll((o) => svc.TargetListMember.filter({ organisation_id: orgId }, o)),
      readAll((o) => svc.ProspectList.filter({ organisation_id: orgId }, o)),
      readAll((o) => svc.Company.filter({ organisation_id: orgId }, o)),
      readAll((o) => svc.Contact.filter({ organisation_id: orgId }, o)),
      readAll((o) => svc.CallLog.filter({ organisation_id: orgId }, o)),
      readAll((o) => svc.UserProfile.filter({ organisation_id: orgId }, o)),
    ]);

    // A campaign owns its accounts through its prospect list(s) and the members on them.
    const campaignListIds = new Set<string>([campaignId]);
    for (const l of lists) if (l.campaign_id === campaignId) campaignListIds.add(l.id);

    const companyIds = new Set<string>();
    for (const m of members) {
      if (m.target_list_id && campaignListIds.has(m.target_list_id) && m.company_id) companyIds.add(m.company_id);
    }

    const campaignContacts = contacts.filter(
      (c) => c.campaign_id === campaignId || (c.company_id && companyIds.has(c.company_id)),
    );
    for (const c of campaignContacts) if (c.company_id) companyIds.add(c.company_id);

    const companyById = new Map<string, any>(companies.map((c) => [c.id, c]));
    const callerName = new Map<string, string>(
      profiles.map((p) => [p.user_id, p.full_name || p.email || 'Caller']),
    );

    const accounts = new Map<string, any>();
    const ensure = (key: string, name?: string) => {
      if (!accounts.has(key)) {
        accounts.set(key, {
          id: key,
          name: name || 'Unknown account',
          domain: '',
          phone: '',
          website: '',
          location: '',
          country: '',
          industry: '',
          employee_range: '',
          linkedin: '',
          generic_email: '',
          business_entity_type: '',
          contacts: [],
          notes: [],
          calls: 0,
          conversations: 0,
          last_contact_at: null,
        });
      }
      return accounts.get(key);
    };

    for (const companyId of companyIds) {
      const company = companyById.get(companyId);
      const account = ensure(companyId, company?.name);
      if (company) {
        account.domain = company.domain || '';
        account.phone = company.landline || '';
        account.website = company.website || '';
        account.location = company.location || '';
        account.country = company.country || '';
        account.industry = company.industry || '';
        account.employee_range = company.employee_range || '';
        account.linkedin = company.linkedin || '';
        account.generic_email = company.generic_email || '';
        account.business_entity_type = company.business_entity_type || '';
      }
    }

    const contactAccountKey = new Map<string, string>();
    for (const c of campaignContacts) {
      const key = c.company_id || `name:${(c.company || 'unknown account').toLowerCase()}`;
      contactAccountKey.set(c.id, key);
      const account = ensure(key, c.company);
      account.contacts.push({
        id: c.id,
        name: c.full_name || '',
        title: c.job_title || '',
        email: c.email || '',
        phone: c.mobile || c.direct_dial || c.phone || '',
        phone_type: c.phone_type || '',
        phone_status: c.phone_status || '',
        call_status: c.call_status || 'new',
        last_called: c.last_called || null,
      });
    }

    const at = (row: any) => row.started_at || row.created_date || null;
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(at(b) || 0).getTime() - new Date(at(a) || 0).getTime(),
    );

    for (const log of sortedLogs) {
      const key = log.company_id || contactAccountKey.get(log.contact_id || '') || '';
      const account = key ? accounts.get(key) : null;
      if (!account) continue;

      account.calls += 1;
      if (log.conversation_held) account.conversations += 1;
      const when = at(log);
      if (when && (!account.last_contact_at || new Date(when) > new Date(account.last_contact_at))) {
        account.last_contact_at = when;
      }

      const text = [log.notes, log.outcome_notes].filter(Boolean).join(' — ').trim();
      if (text && account.notes.length < MAX_NOTES_PER_ACCOUNT) {
        account.notes.push({
          id: log.id,
          at: when,
          caller: callerName.get(log.user_id) || '',
          contact_name: log.contact_name || '',
          outcome: log.primary_outcome || log.outcome || '',
          next_action: log.next_action_type || '',
          text,
        });
      }
    }

    const rows = [...accounts.values()]
      .map((a) => ({
        ...a,
        contacts: a.contacts
          .sort((x: any, y: any) => new Date(y.last_called || 0).getTime() - new Date(x.last_called || 0).getTime())
          .slice(0, MAX_CONTACTS_PER_ACCOUNT),
      }))
      .sort((a, b) => {
        const aTime = a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0;
        const bTime = b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return String(a.name).localeCompare(String(b.name));
      });

    const emailSet = new Set<string>();
    let people = 0;
    let notes = 0;
    for (const a of rows) {
      for (const c of a.contacts) {
        people += 1;
        if (c.email) emailSet.add(c.email.toLowerCase());
      }
      notes += a.notes.length;
    }

    return Response.json({
      campaign: { id: campaign.id, name: campaign.name },
      accounts: rows,
      totals: {
        accounts: rows.length,
        people,
        emails: emailSet.size,
        notes,
        called: rows.filter((a) => a.calls > 0).length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}