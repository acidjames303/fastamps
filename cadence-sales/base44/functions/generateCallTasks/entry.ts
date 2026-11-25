import { resolveTenant } from '../../shared/tenantAuth.ts';
import { isReadOnly } from '../../shared/taskLogic.ts';

// Generates initial call Tasks from approved campaign assignments.
// Only managers+ can run this. Supports dry-run to preview eligible records.
// Prevents duplicates via idempotency_key. Skips invalid numbers and DNC contacts.
// Stores UTC due timestamps; due_date is the org-timezone calendar day.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot generate tasks.' }, { status: 403 });
  }
  const managerRoles = ['sales_manager', 'organisation_admin', 'platform_owner'];
  if (!managerRoles.includes(profile.app_role)) {
    return Response.json({ error: 'Only managers can generate call tasks.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { campaign_id, dry_run = false, limit = 50 } = body || {};

  if (!campaign_id) {
    return Response.json({ error: 'campaign_id is required.' }, { status: 400 });
  }

  // 1. Verify campaign belongs to this org
  const campaigns = await base44.asServiceRole.entities.Campaign.filter(
    { organisation_id: org.id, id: campaign_id }, '-created_date', 1
  ).catch(() => []);
  if (!campaigns || !campaigns[0]) {
    return Response.json({ error: 'Campaign not found in your organisation.' }, { status: 404 });
  }

  // 2. Find approved assignments with an assigned caller
  const assignments = await base44.asServiceRole.entities.CampaignAssignment.filter(
    { organisation_id: org.id, campaign_id, status: 'assigned' }, '-created_date', 500
  ).catch(() => []);

  // 3. For each assignment, check contact and suppression
  const now = new Date();
  const dueAt = now.toISOString();
  const dueDate = dueAt.split('T')[0];
  const timezone = org.timezone || 'Europe/London';

  const eligible = [];
  const skipped = { no_contact: 0, no_phone: 0, bad_number: 0, dnc: 0, suppressed: 0, duplicate: 0 };

  // Collect all contact IDs for batch suppression check
  const contactIds = assignments.map(a => a.contact_id).filter(Boolean);
  let suppressionMap = {};
  if (contactIds.length) {
    const suppressions = await base44.asServiceRole.entities.SuppressionEntry.filter(
      { organisation_id: org.id, status: 'active' }, '-created_date', 500
    ).catch(() => []);
    for (const s of (suppressions || [])) {
      if (s.contact_id) suppressionMap[s.contact_id] = true;
    }
  }

  // Check existing active tasks to prevent duplicates
  const existingTasks = await base44.asServiceRole.entities.Task.filter(
    { organisation_id: org.id, target_list_id: campaign_id, status: 'pending' }, '-created_date', 500
  ).catch(() => []);
  const existingContactIds = new Set(existingTasks.map(t => t.contact_id).filter(Boolean));

  for (const a of assignments) {
    if (!a.contact_id) { skipped.no_contact++; continue; }
    if (existingContactIds.has(a.contact_id)) { skipped.duplicate++; continue; }

    // Fetch contact
    const contact = await base44.asServiceRole.entities.Contact.get(a.contact_id).catch(() => null);
    if (!contact) { skipped.no_contact++; continue; }

    // Check phone
    if (!contact.phone || !contact.phone.trim()) { skipped.no_phone++; continue; }
    if (contact.number_status === 'bad' || contact.number_status === 'dnc') { skipped.bad_number++; continue; }
    if (contact.do_not_call) { skipped.dnc++; continue; }
    if (contact.marketing_status === 'suppressed' || contact.marketing_status === 'objected') { skipped.suppressed++; continue; }
    if (suppressionMap[contact.id]) { skipped.suppressed++; continue; }

    eligible.push({
      assignment_id: a.id,
      contact_id: contact.id,
      contact_name: contact.full_name,
      company_id: a.company_id,
      assigned_user_id: a.assigned_user_id,
      phone: contact.phone,
    });
  }

  if (dry_run) {
    return Response.json({
      dry_run: true,
      campaign_id,
      total_assignments: assignments.length,
      eligible: eligible.length,
      skipped,
      eligible_records: eligible.slice(0, limit),
    });
  }

  // 4. Create Tasks for eligible records (up to limit)
  const toCreate = eligible.slice(0, limit);
  const created = [];
  for (const e of toCreate) {
    const idemKey = org.id + ':new_call:' + e.contact_id;
    try {
      const task = await base44.asServiceRole.entities.Task.create({
        organisation_id: org.id,
        assigned_user_id: e.assigned_user_id,
        created_by_user_id: user.id,
        target_list_id: campaign_id,
        company_id: e.company_id,
        contact_id: e.contact_id,
        task_type: 'new_call',
        title: 'New call — ' + (e.contact_name || ''),
        status: 'pending',
        priority: 'normal',
        due_at: dueAt,
        due_date: dueDate,
        source: 'target_list',
        source_reference: e.assignment_id,
        idempotency_key: idemKey,
        attempt_number: 1,
        maximum_attempts: 6,
        timezone,
      });
      created.push({ id: task.id, contact_id: e.contact_id, contact_name: e.contact_name });
    } catch (err) {
      // Skip individual failures
    }
  }

  return Response.json({
    dry_run: false,
    campaign_id,
    total_assignments: assignments.length,
    eligible: eligible.length,
    created: created.length,
    skipped,
    created_tasks: created,
  });
}