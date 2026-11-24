import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/roleGuards.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { recordAttempt } from '../../shared/researchJob.ts';

// Batch contact enrichment — reveals phone + email for contacts missing them.
// Uses Lusha (primary) with FullEnrich fallback. Charges credits on success.
// Processes up to ~4.5 min so a single invocation can cover a large batch.
export default async function(req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const { contact_ids, limit, approved } = body || {};

    if (!approved) {
      return Response.json({ error: 'Explicit approval is required before paid batch enrichment.' }, { status: 403 });
    }

    // Fetch contacts missing phone or email
    let contacts;
    if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
      contacts = await base44.asServiceRole.entities.Contact.filter(
        { organisation_id: org.id }, '-created_date', 500
      );
      const idSet = new Set(contact_ids);
      contacts = contacts.filter(c => idSet.has(c.id));
    } else {
      contacts = await base44.asServiceRole.entities.Contact.filter(
        { organisation_id: org.id }, '-created_date', 500
      );
    }

    // Only enrich contacts missing phone or email
    const needEnrichment = contacts.filter(c => !c.phone || !c.email).slice(0, limit || 100);

    if (needEnrichment.length === 0) {
      return Response.json({ message: 'No contacts need enrichment.', processed: 0, enriched: 0 });
    }

    const creds = await getOrgCredentials(base44, org);
    const lushaKey = (creds.get('LUSHA_API_KEY') || '').trim();
    const fullKey = (creds.get('FULLENRICH_API_KEY') || '').trim();

    if (!lushaKey && !fullKey) {
      return Response.json({ error: 'No enrichment provider credentials configured.' }, { status: 400 });
    }

    // Fetch companies for domain lookup
    const companyIds = [...new Set(needEnrichment.map(c => c.company_id).filter(Boolean))];
    const companies = await base44.asServiceRole.entities.Company.filter(
      { organisation_id: org.id }, '-created_date', 500
    );
    const companyMap = new Map(companies.map(c => [c.id, c]));

    const startedAt = Date.now();
    const TIME_BUDGET_MS = 270000; // 4.5 min
    const CHUNK = 6; // parallel Lusha calls
    let enriched = 0;
    let failed = 0;
    let processed = 0;

    for (let i = 0; i < needEnrichment.length; i += CHUNK) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const slice = needEnrichment.slice(i, i + CHUNK);

      const outcomes = await Promise.all(slice.map(async (contact) => {
        try {
          const company = companyMap.get(contact.company_id);
          const companyName = company?.name || contact.company || '';
          const domain = company?.domain || '';

          let revealedPhone = '';
          let revealedEmail = '';
          let provider = '';

          // Lusha: reveal both phone and email in one call
          if (lushaKey && contact.full_name) {
            try {
              const res = await fetch('https://api.lusha.com/v3/contacts/search-and-enrich', {
                method: 'POST',
                headers: { api_key: lushaKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contacts: [{ fullName: contact.full_name, companyName, ...(domain ? { companyDomain: domain } : {}) }],
                  reveal: ['phones', 'emails'],
                }),
              });
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                const r = (data.results || [])[0];
                if (r && !r.error) {
                  // Pick best phone
                  const phones = (r.phones || []).filter(p => p && p.number && !p.doNotCall);
                  if (phones.length && !contact.phone) {
                    const order = ['mobile', 'direct', 'work', 'unknown'];
                    phones.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
                    revealedPhone = phones[0].number;
                  }
                  // Pick best email
                  const emails = r.emails || [];
                  if (emails.length && !contact.email) {
                    const work = emails.find(e => e.email && (e.type === 'work' || e.confidence === 'A+'));
                    revealedEmail = (work || emails.find(e => e.email) || {}).email || '';
                  }
                  if (revealedPhone || revealedEmail) provider = 'lusha';
                }
              }
            } catch {}
          }

          // FullEnrich fallback for phone only (email not supported via bulk)
          if (!revealedPhone && !contact.phone && fullKey && contact.full_name) {
            try {
              const parts = contact.full_name.trim().split(/\s+/);
              const firstName = parts[0] || '';
              const lastName = parts.slice(1).join(' ') || '';
              const start = await fetch('https://app.fullenrich.com/api/v2/contact/enrich/bulk', {
                method: 'POST',
                headers: { Authorization: `Bearer ${fullKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: `Batch ${companyName}`.slice(0, 80),
                  data: [{
                    first_name: firstName, last_name: lastName, company_name: companyName,
                    ...(domain ? { domain } : {}),
                    enrich_fields: ['contact.phones'],
                  }],
                }),
              });
              if (start.ok) {
                const eid = (await start.json().catch(() => ({}))).enrichment_id;
                if (eid) {
                  let result = null;
                  const deadline = Date.now() + 20000;
                  while (Date.now() < deadline) {
                    await new Promise(r => setTimeout(r, 3000));
                    const g = await fetch(`https://app.fullenrich.com/api/v2/contact/enrich/bulk/${eid}`, {
                      headers: { Authorization: `Bearer ${fullKey}` },
                    });
                    if (!g.ok) continue;
                    result = await g.json().catch(() => null);
                    if (result && result.status === 'FINISHED') break;
                  }
                  const row = (result?.data || [])[0];
                  const ci = row?.contact_info || {};
                  const num = ci.most_probable_phone?.number || ci.phones?.[0]?.number || '';
                  if (num) {
                    revealedPhone = num;
                    if (!provider) provider = 'fullenrich';
                  }
                }
              }
            } catch {}
          }

          // Update contact if we got data
          const patch = {};
          if (revealedPhone && !contact.phone) {
            patch.phone = revealedPhone;
            patch.number_status = 'untested';
            patch.source = provider;
          }
          if (revealedEmail && !contact.email) {
            patch.email = revealedEmail;
            if (!patch.source) patch.source = provider;
          }

          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.Contact.update(contact.id, patch);

            // Record usage (1 credit per successful reveal)
            const cost = (revealedPhone ? 1 : 0) + (revealedEmail ? 1 : 0);
            if (cost > 0) {
              await recordUsage(base44, {
                organisation_id: org.id, user_id: user.id,
                event_type: 'phone_enrichment', provider, quantity: cost,
                estimated_cost: cost, actual_cost: cost, related_record_id: contact.id,
              });
            }

            await recordAttempt(base44, {
              organisation_id: org.id, company_id: contact.company_id, contact_id: contact.id,
              provider, enrichment_type: 'direct_phone', status: 'successful',
              fields_returned: Object.keys(patch).filter(k => k === 'phone' || k === 'email'),
              estimated_cost: cost, actual_cost: cost,
            });

            return { ok: true, contact_id: contact.id, phone: !!revealedPhone, email: !!revealedEmail, provider };
          }

          // Not found — record cooldown
          await recordAttempt(base44, {
            organisation_id: org.id, company_id: contact.company_id, contact_id: contact.id,
            provider: 'lusha', enrichment_type: 'direct_phone', status: 'not_found',
            estimated_cost: 1, safe_error_message: 'No phone or email found by any provider.',
          });

          return { ok: false, contact_id: contact.id };
        } catch (e) {
          return { ok: false, contact_id: contact.id, error: e.message };
        }
      }));

      for (const o of outcomes) {
        processed++;
        if (o.ok) enriched++;
        else failed++;
      }
    }

    return Response.json({
      processed,
      enriched,
      failed,
      truncated: processed < needEnrichment.length,
      remaining: needEnrichment.length - processed,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}