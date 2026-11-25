import { resolveTenant } from '../../shared/tenantAuth.ts';
import { taskIdempotencyKey, findActiveByTaskKey } from '../../shared/taskLogic.ts';
import { orgTimezone } from '../../shared/taskTime.ts';

// Phase D: one-time migration of reliable existing work into Task records.
// Creates tasks ONLY when intent is reliable and a date exists:
//   - Approved call-ready contact with no active task → new_call task
//   - TargetListCompanyFit review_status = needs_review → research_review task
// Ambiguous historical records (callback/interested without a future date)
// are NOT given invented dates — they surface in Today's "Needs scheduling"
// section instead. Migration is idempotent (skips records with active tasks).
// No AI, no integration credits.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (!['organisation_admin', 'sales_manager', 'platform_owner'].includes(profile.app_role)) {
    return Response.json({ error: 'Only managers can run the historical task migration.' }, { status: 403 });
  }

  const orgId = org.id;
  const [contacts, fits, members] = await Promise.all([
    base44.asServiceRole.entities.Contact.filter({ organisation_id: orgId }, '-updated_date', 1000).catch(() => []),
    base44.asServiceRole.entities.TargetListCompanyFit.filter({ organisation_id: orgId }, '-scored_at', 1000).catch(() => []),
    base44.asServiceRole.entities.TargetListMember.filter({ organisation_id: orgId }, '-created_date', 1000).catch(() => []),
  ]);

  const report = { created: 0, skipped: 0, ambiguous: 0, duplicates_prevented: 0, failed: 0, details: [] };

  // 1. Approved call-ready contacts → new_call tasks.
  //    A contact is call-ready if it has a phone and number_status is not bad/dnc,
  //    and its company has an approved fit in some target list.
  const approvedFits = (fits || []).filter((f) => f.review_status === 'approved' && f.fit_band !== 'excluded');
  const fitByCompany = new Map();
  for (const f of approvedFits) {
    if (!fitByCompany.has(f.company_id)) fitByCompany.set(f.company_id, []);
    fitByCompany.get(f.company_id).push(f);
  }

  for (const contact of (contacts || [])) {
    if (!contact.phone) { report.ambiguous++; continue; }
    if (['bad', 'dnc'].includes(contact.number_status)) { report.skipped++; continue; }
    if (!contact.company_id) { report.ambiguous++; continue; }
    const fitsForCompany = fitByCompany.get(contact.company_id) || [];
    if (!fitsForCompany.length) { report.skipped++; continue; }

    for (const fit of fitsForCompany) {
      const idemKey = taskIdempotencyKey(orgId, 'new_call', contact.id);
      const existing = await findActiveByTaskKey(base44, orgId, idemKey);
      if (existing) { report.duplicates_prevented++; continue; }

      try {
        await base44.asServiceRole.entities.Task.create({
          organisation_id: orgId,
          assigned_user_id: contact.owner_user_id || '',
          created_by_user_id: user.id,
          target_list_id: fit.target_list_id,
          company_id: contact.company_id,
          contact_id: contact.id,
          task_type: 'new_call',
          title: `Call ${contact.full_name || 'prospect'}`,
          status: 'pending',
          priority: 'normal',
          source: 'prospect_approval',
          source_reference: contact.id,
          idempotency_key: idemKey,
          attempt_number: 1,
          maximum_attempts: 1,
          timezone: orgTimezone(org),
        });
        report.created++;
      } catch (e) {
        report.failed++;
        report.details.push(`Failed for contact ${contact.id}: ${(e.message || '').slice(0, 100)}`);
      }
    }
  }

  // 2. Needs-review fits → research_review tasks.
  const needsReviewFits = (fits || []).filter((f) => f.review_status === 'needs_review');
  for (const fit of needsReviewFits) {
    const idemKey = taskIdempotencyKey(orgId, 'research_review', fit.company_id);
    const existing = await findActiveByTaskKey(base44, orgId, idemKey);
    if (existing) { report.duplicates_prevented++; continue; }
    try {
      await base44.asServiceRole.entities.Task.create({
        organisation_id: orgId,
        assigned_user_id: '',
        created_by_user_id: user.id,
        target_list_id: fit.target_list_id,
        company_id: fit.company_id,
        task_type: 'research_review',
        title: 'Review company research',
        description: 'Company fit marked needs review. Verify research accuracy before calling.',
        status: 'pending',
        priority: 'normal',
        source: 'system',
        source_reference: fit.id,
        idempotency_key: idemKey,
        attempt_number: 1,
        maximum_attempts: 1,
        timezone: orgTimezone(org),
      });
      report.created++;
    } catch (e) {
      report.failed++;
      report.details.push(`Failed for fit ${fit.id}: ${(e.message || '').slice(0, 100)}`);
    }
  }

  // 3. Ambiguous: callback/interested contacts with no future date.
  //    These are counted (not given invented dates) and surfaced in Today.
  const taskContactIds = new Set(
    (await base44.asServiceRole.entities.Task.filter({ organisation_id: orgId }, '-created_date', 1000).catch(() => []))
      .filter((t) => ['pending', 'in_progress'].includes(t.status) && t.contact_id)
      .map((t) => t.contact_id)
  );
  for (const contact of (contacts || [])) {
    if (['callback', 'interested'].includes(contact.call_status) && !taskContactIds.has(contact.id) && contact.number_status !== 'dnc') {
      report.ambiguous++;
    }
  }

  return Response.json(report);
}