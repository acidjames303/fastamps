import { resolveTenant } from '../../shared/tenantAuth.ts';
import {
  MAX_PUSH,
  cleanText,
  finalisePlan,
  normaliseEmail,
  prepareCandidates,
} from '../../shared/outreachPush.ts';

// Moves prospect contacts into an outreach campaign. Server-side only: the
// organisation, owner, campaign and prospects are all re-resolved here, so a
// client can never push another tenant's records. Preview and push use the same
// plan, and nothing is ever sent or scheduled by this function.
const ROLES = ['platform_owner', 'organisation_admin', 'sales_manager', 'internal_bd', 'bdm'];

async function hashEmail(email: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function (req: Request) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!ROLES.includes(profile.app_role)) {
      return Response.json({ error: 'Outreach is not enabled for this user role.' }, { status: 403 });
    }

    const input: any = await req.json().catch(() => ({}));
    const action = cleanText(input.action, 20) || 'preview';
    if (!['preview', 'push'].includes(action)) {
      return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const svc = base44.asServiceRole.entities;
    const brandKey = cleanText(input.brand_key, 60) || 'fastamps';
    const campaignId = cleanText(input.campaign_id, 100);
    const listId = cleanText(input.prospect_list_id, 100);
    const scope = cleanText(input.scope, 20) === 'all' ? 'all' : 'selected';
    const ids = [
      ...new Set((Array.isArray(input.prospect_ids) ? input.prospect_ids : []).map((id: any) => cleanText(id, 100)).filter(Boolean)),
    ];

    if (!campaignId) return Response.json({ error: 'Choose the outreach campaign first.' }, { status: 400 });
    if (ids.length > MAX_PUSH) return Response.json({ error: `Push at most ${MAX_PUSH} contacts at a time.` }, { status: 400 });
    if (scope === 'selected' && !ids.length) {
      return Response.json({ error: 'Select at least one prospect, or switch to all eligible.' }, { status: 400 });
    }
    if (scope === 'all' && !listId) {
      return Response.json({ error: 'Choose the prospect list to push from.' }, { status: 400 });
    }

    const campaign = await svc.Campaign.get(campaignId).catch(() => null);
    if (!campaign || campaign.organisation_id !== org.id) {
      return Response.json({ error: 'Campaign not found in your organisation.' }, { status: 404 });
    }

    const where = scope === 'selected'
      ? { organisation_id: org.id, id: { $in: ids } }
      : { organisation_id: org.id, list_id: listId };
    const prospects = (await svc.Prospect.filter(where, '-created_date', MAX_PUSH)) || [];

    const prospectIds = prospects.map((p: any) => p.id);
    const researchRows = prospectIds.length
      ? (await svc.AccountResearch.filter(
          { organisation_id: org.id, prospect_id: { $in: prospectIds } },
          '-researched_at',
          400
        )) || []
      : [];
    const researchByProspect = new Map<string, any>();
    for (const row of researchRows) {
      if (!researchByProspect.has(row.prospect_id)) researchByProspect.set(row.prospect_id, row);
    }

    const now = new Date().toISOString();
    const prepared = prepareCandidates({
      prospects,
      researchByProspect,
      campaign,
      brandKey,
      ownerUserId: user.id,
      organisationId: org.id,
      now,
    });

    const emails = [...new Set(prepared.candidates.map((c: any) => c.email))];
    const hashes = await Promise.all(emails.map(hashEmail));
    const [existing, suppressions, drafts] = await Promise.all([
      emails.length
        ? svc.OutreachLead.filter(
            { organisation_id: org.id, owner_user_id: user.id, brand_key: brandKey, normalised_email: { $in: emails } },
            '-created_at',
            500
          )
        : [],
      hashes.length
        ? svc.SuppressionEntry.filter(
            { organisation_id: org.id, normalised_email_hash: { $in: hashes }, status: 'active' },
            '-recorded_at',
            300
          )
        : [],
      emails.length
        ? svc.OutreachDraft.filter(
            { organisation_id: org.id, owner_user_id: user.id, recipient_to: { $in: emails } },
            '-created_at',
            300
          )
        : [],
    ]);

    const hashByEmail = new Map(emails.map((email, index) => [email, hashes[index]]));
    const stoppedHashes = new Set((suppressions || []).map((row: any) => row.normalised_email_hash));
    const suppressedEmails = new Set(emails.filter((email) => stoppedHashes.has(hashByEmail.get(email) as string)));
    const existingEmails = new Set([
      ...(existing || []).map((row: any) => normaliseEmail(row.normalised_email || row.email)),
      ...(drafts || []).map((row: any) => normaliseEmail(row.recipient_to)),
    ]);

    const plan = finalisePlan(prepared.candidates, { existingEmails, suppressedEmails });
    const extra = (reason: string) => prepared.skipped.filter((row: any) => row.reason === reason).length;
    const counts = {
      ...plan.counts,
      considered: prospects.length,
      no_email: plan.counts.no_email + extra('no_email'),
      duplicate_in_selection: plan.counts.duplicate_in_selection + extra('duplicate_in_selection'),
    };
    const skipped = [...prepared.skipped, ...plan.skipped].slice(0, 40);

    if (action === 'preview') {
      return Response.json({
        ok: true,
        mode: 'preview',
        counts,
        skipped,
        sample: plan.items.slice(0, 8).map((item: any) => ({
          company_name: item.company_name,
          full_name: item.full_name,
          email: item.email,
          job_title: item.job_title,
          review_status: item.review_status,
          research_evidence_status: item.research_evidence_status,
          research_fact: item.research_fact,
        })),
      });
    }

    if (!plan.items.length) {
      return Response.json({ ok: true, mode: 'push', created: 0, counts, skipped, message: 'Nothing new to push.' });
    }

    const created = await svc.OutreachLead.bulkCreate(plan.items);
    return Response.json({
      ok: true,
      mode: 'push',
      created: Array.isArray(created) ? created.length : plan.items.length,
      counts,
      skipped,
      message: 'Contacts pushed for review. No emails were drafted or sent.',
    });
  } catch (error: any) {
    return Response.json(
      { error: cleanText(error?.message || 'Could not push prospects to outreach', 500) },
      { status: error?.status || 500 }
    );
  }
}