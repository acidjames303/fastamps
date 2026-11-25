import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { validateActivation } from '../../shared/campaignMetrics.ts';
import { taskIdempotencyKey, findActiveByTaskKey } from '../../shared/taskLogic.ts';
import { getFollowUpSettings, nextValidCallingTime } from '../../shared/outcomeRules.ts';

// Activates a campaign: validates prerequisites, creates initial call Tasks
// for eligible assignments (idempotent), and sets status to 'active'.
// Never creates duplicate active tasks, tasks for DNC/invalid contacts, or
// tasks for completed/suppressed assignments.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'Only managers can activate campaigns' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });

    const campaign = await assertListOwned(base44, org, campaign_id);
    if (!['draft', 'ready', 'paused'].includes(campaign.status)) {
      return Response.json({ error: `Campaign is ${campaign.status} — cannot activate` }, { status: 400 });
    }

    // Fetch all assignments for this campaign
    const assignments = await base44.asServiceRole.entities.CampaignAssignment.filter(
      { organisation_id: org.id, campaign_id }, '-created_date', 500
    ).catch(() => []);

    // Fetch contacts for assigned companies
    const companyIds = [...new Set(assignments.map((a) => a.company_id))];
    const contacts = [];
    for (const cid of companyIds) {
      const companyContacts = await base44.asServiceRole.entities.Contact.filter(
        { organisation_id: org.id, company_id: cid }, '-created_date', 20
      ).catch(() => []);
      contacts.push(...companyContacts);
    }

    // Validate activation prerequisites
    const validation = validateActivation(campaign, assignments, contacts);
    if (!validation.valid) {
      return Response.json({ error: 'Cannot activate campaign', errors: validation.errors }, { status: 400 });
    }

    const settings = getFollowUpSettings(org);
    const now = Date.now();
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    for (const assignment of assignments) {
      if (['completed', 'suppressed', 'removed'].includes(assignment.status)) {
        skipped++;
        continue;
      }
      if (!assignment.assigned_user_id) {
        skipped++;
        continue;
      }

      // Find the best contact for this assignment
      let contact = null;
      if (assignment.contact_id) {
        contact = contacts.find((c) => c.id === assignment.contact_id);
      } else {
        // Find a dialable contact for this company
        contact = contacts.find(
          (c) => c.company_id === assignment.company_id && c.phone && c.number_status !== 'dnc' && c.number_status !== 'bad'
        );
      }

      // Skip DNC / bad number contacts
      if (contact && (contact.number_status === 'dnc' || contact.number_status === 'bad')) {
        skipped++;
        continue;
      }

      // Determine task type: new_call if dialable, research_review if no contact
      const taskType = contact ? 'new_call' : 'research_review';
      const refId = contact?.id || assignment.company_id;
      const idemKey = taskIdempotencyKey(org.id, taskType, refId);

      // Check for existing active task (idempotency)
      const existing = await findActiveByTaskKey(base44, org.id, idemKey);
      if (existing) {
        skipped++;
        continue;
      }

      // Compute due_at using campaign calling hours
      const dueMs = nextValidCallingTime(now, settings);

      try {
        const task = await base44.asServiceRole.entities.Task.create({
          organisation_id: org.id,
          target_list_id: campaign_id,
          company_id: assignment.company_id,
          contact_id: contact?.id || '',
          assigned_user_id: assignment.assigned_user_id,
          task_type: taskType,
          status: 'pending',
          due_at: new Date(dueMs).toISOString(),
          priority: campaign.priority || 'normal',
          source: 'target_list',
          source_reference: `campaign:${campaign_id}:assignment:${assignment.id}`,
          idempotency_key: idemKey,
          attempt_number: 1,
          maximum_attempts: 8,
          timezone: org.timezone || 'Europe/London',
        });

        // Link assignment to the new task
        await base44.asServiceRole.entities.CampaignAssignment.update(assignment.id, {
          next_task_id: task.id,
          status: 'assigned',
          started_at: new Date().toISOString(),
        });

        created++;
      } catch (err) {
        failed++;
        failures.push({ assignment_id: assignment.id, error: err.message });
      }
    }

    // Update campaign status
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      status: 'active',
    });

    // Create audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        organisation_id: org.id,
        actor_user_id: user.id,
        action: 'opportunity_created',
        entity_type: 'Campaign',
        entity_id: campaign_id,
        new_value: 'active',
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return Response.json({
      status: 'active',
      tasks_created: created,
      tasks_skipped: skipped,
      tasks_failed: failed,
      failures: failures.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}