import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';

// BDM push: put a campaign (active or historic) into one SDR's account.
// Adds the caller to campaign.assigned_user_ids, assigns / reassigns companies,
// and points open call tasks at them. Never auto-sends email.
// All record work is done in bulk so a large campaign pushes in seconds.

const WRITE_CHUNK = 200;

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'Only BDMs and admins can push campaigns.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id, caller_user_id, mode = 'assign_available' } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });
    if (!caller_user_id) return Response.json({ error: 'caller_user_id required' }, { status: 400 });

    const campaign = await assertListOwned(base44, org, campaign_id);
    const svc = base44.asServiceRole.entities;

    const callerProfiles = await svc.UserProfile.filter(
      { organisation_id: org.id, user_id: caller_user_id }, '-created_date', 1,
    ).catch(() => []);
    const caller = callerProfiles?.[0];
    if (!caller || caller.status !== 'active') {
      return Response.json({ error: 'Caller is not an active member of this organisation.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const reason = `Pushed by ${profile.full_name || user.email || 'manager'} from Team`;

    // 1. Ensure caller is on the campaign roster
    const assignedUsers = [...new Set([...(campaign.assigned_user_ids || []), caller_user_id])];
    await svc.Campaign.update(campaign_id, { assigned_user_ids: assignedUsers });

    // 2. Load existing assignments, list members and open tasks in parallel.
    const [assignments, members, openTasks] = await Promise.all([
      svc.CampaignAssignment.filter(
        { organisation_id: org.id, campaign_id }, '-created_date', 1000,
      ).catch(() => []),
      svc.TargetListMember.filter(
        { organisation_id: org.id, target_list_id: campaign_id }, '-created_date', 1000,
      ).catch(() => []),
      svc.Task.filter(
        { organisation_id: org.id, target_list_id: campaign_id, status: 'pending' }, '-created_date', 1000,
      ).catch(() => []),
    ]);

    const existingByCompany = new Map((assignments || []).map((a) => [a.company_id, a]));

    // 3. Create assignments for list members that have none yet — one bulk write.
    const toCreate = [];
    const seen = new Set();
    for (const m of members || []) {
      if (!m.company_id || existingByCompany.has(m.company_id) || seen.has(m.company_id)) continue;
      seen.add(m.company_id);
      toCreate.push({
        organisation_id: org.id,
        campaign_id,
        company_id: m.company_id,
        contact_id: m.contact_id || '',
        assigned_user_id: caller_user_id,
        assigned_by_user_id: user.id,
        status: 'assigned',
        assignment_method: 'manager_push',
        assigned_at: now,
        priority: 'normal',
        lock_version: 1,
      });
    }
    for (const part of chunks(toCreate, WRITE_CHUNK)) {
      await svc.CampaignAssignment.bulkCreate(part);
    }

    // 4. Reassign / claim eligible assignments in bulk.
    // assign_available = unassigned only; reassign_all = every open assignment.
    const reassignUpdates = [];
    const reassignedCompanies = new Set();
    for (const a of existingByCompany.values()) {
      if (['completed', 'removed', 'suppressed'].includes(a.status)) continue;
      if (a.assigned_user_id === caller_user_id) continue;
      if (mode !== 'reassign_all' && a.assigned_user_id) continue;

      reassignUpdates.push({
        id: a.id,
        assigned_user_id: caller_user_id,
        assigned_by_user_id: user.id,
        assignment_method: 'manager_push',
        reassignment_reason: reason,
        lock_version: (a.lock_version || 1) + 1,
        locked_by_user_id: '',
        locked_at: '',
        status: a.status === 'unassigned' ? 'assigned' : a.status,
      });
      reassignedCompanies.add(a.company_id);
    }
    for (const part of chunks(reassignUpdates, WRITE_CHUNK)) {
      await svc.CampaignAssignment.bulkUpdate(part);
    }

    // 5. Point open call tasks at the caller — one bulk write, no per-company read.
    const taskUpdates = (openTasks || [])
      .filter((t) => reassignedCompanies.has(t.company_id))
      .filter((t) => t.task_type !== 'info_request_followup')
      .filter((t) => t.assigned_user_id !== caller_user_id)
      .map((t) => ({ id: t.id, assigned_user_id: caller_user_id }));
    for (const part of chunks(taskUpdates, WRITE_CHUNK)) {
      await svc.Task.bulkUpdate(part);
    }

    const created = toCreate.length;
    const reassigned = reassignUpdates.length;

    try {
      await svc.AuditLog.create({
        organisation_id: org.id,
        actor_user_id: user.id,
        action: 'campaign_pushed_to_caller',
        entity_type: 'Campaign',
        entity_id: campaign_id,
        new_value: caller_user_id,
        timestamp: now,
        details: { created, reassigned, mode, reason },
      });
    } catch { /* non-fatal */ }

    try {
      await svc.Notice.create({
        organisation_id: org.id,
        user_id: caller_user_id,
        type: 'campaign_assigned',
        title: 'Campaign pushed to you',
        body: `${campaign.name || 'A campaign'} was added to your queue by your BDM.`,
        related_entity_type: 'Campaign',
        related_entity_id: campaign_id,
        created_at: now,
      });
    } catch { /* non-fatal */ }

    return Response.json({
      ok: true,
      campaign_id,
      caller_user_id,
      created,
      reassigned,
      assigned_user_ids: assignedUsers,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}