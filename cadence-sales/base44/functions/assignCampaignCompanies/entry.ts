import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned, assertCompanyOwned } from '../../shared/ownership.ts';

// Assigns companies to callers within a campaign.
// Methods: manual, even_distribution, round_robin.
// Creates CampaignAssignment records, never across organisations.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'Only managers can assign companies' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id, method, company_ids, user_ids, manual_assignments } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });
    if (!method) return Response.json({ error: 'method required (manual, even_distribution, round_robin)' }, { status: 400 });

    const campaign = await assertListOwned(base44, org, campaign_id);
    if (!user_ids || user_ids.length === 0) {
      return Response.json({ error: 'At least one caller must be selected' }, { status: 400 });
    }

    // Verify all selected users belong to this org and are active
    const userProfiles = await base44.asServiceRole.entities.UserProfile.filter(
      { organisation_id: org.id }, '-created_date', 100
    ).catch(() => []);

    const validUserIds = userProfiles
      .filter((p) => user_ids.includes(p.user_id) && p.status === 'active')
      .map((p) => p.user_id);

    if (validUserIds.length === 0) {
      return Response.json({ error: 'No active callers selected' }, { status: 400 });
    }

    // Verify companies belong to org
    for (const cid of company_ids || []) {
      await assertCompanyOwned(base44, org, cid);
    }

    // Fetch existing assignments for this campaign to detect duplicates
    const existingAssignments = await base44.asServiceRole.entities.CampaignAssignment.filter(
      { organisation_id: org.id, campaign_id }, '-created_date', 500
    ).catch(() => []);

    const existingCompanyIds = new Set(existingAssignments.map((a) => a.company_id));
    const now = new Date().toISOString();
    const created = [];

    if (method === 'manual' && manual_assignments) {
      // manual_assignments: [{ company_id, user_id }]
      for (const ma of manual_assignments) {
        if (existingCompanyIds.has(ma.company_id)) continue;
        if (!validUserIds.includes(ma.user_id)) continue;

        const assignment = await base44.asServiceRole.entities.CampaignAssignment.create({
          organisation_id: org.id,
          campaign_id,
          company_id: ma.company_id,
          assigned_user_id: ma.user_id,
          assigned_by_user_id: user.id,
          status: 'assigned',
          assignment_method: 'manual',
          assigned_at: now,
          priority: 'normal',
          lock_version: 1,
        });
        created.push(assignment);
      }
    } else if (method === 'even_distribution') {
      // Distribute unassigned companies evenly across selected users
      const newCompanyIds = (company_ids || []).filter((cid) => !existingCompanyIds.has(cid));

      // Count current assignments per user
      const counts = {};
      for (const uid of validUserIds) counts[uid] = 0;
      for (const a of existingAssignments) {
        if (validUserIds.includes(a.assigned_user_id) && a.status !== 'completed' && a.status !== 'removed') {
          counts[a.assigned_user_id] = (counts[a.assigned_user_id] || 0) + 1;
        }
      }

      for (const cid of newCompanyIds) {
        // Pick user with fewest assignments
        const targetUser = validUserIds.reduce((min, uid) => (counts[uid] < counts[min] ? uid : min), validUserIds[0]);
        counts[targetUser]++;

        const assignment = await base44.asServiceRole.entities.CampaignAssignment.create({
          organisation_id: org.id,
          campaign_id,
          company_id: cid,
          assigned_user_id: targetUser,
          assigned_by_user_id: user.id,
          status: 'assigned',
          assignment_method: 'even_distribution',
          assigned_at: now,
          priority: 'normal',
          lock_version: 1,
        });
        created.push(assignment);
      }
    } else if (method === 'round_robin') {
      // Round robin: use last assigned user, pick next in list
      const newCompanyIds = (company_ids || []).filter((cid) => !existingCompanyIds.has(cid));

      // Find the last assignment's user to continue round-robin
      const sortedAssignments = existingAssignments
        .filter((a) => a.assigned_at && validUserIds.includes(a.assigned_user_id))
        .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

      let lastIndex = -1;
      if (sortedAssignments.length > 0) {
        lastIndex = validUserIds.indexOf(sortedAssignments[0].assigned_user_id);
      }

      for (let i = 0; i < newCompanyIds.length; i++) {
        const userIdx = (lastIndex + 1 + i) % validUserIds.length;
        const targetUser = validUserIds[userIdx];

        const assignment = await base44.asServiceRole.entities.CampaignAssignment.create({
          organisation_id: org.id,
          campaign_id,
          company_id: newCompanyIds[i],
          assigned_user_id: targetUser,
          assigned_by_user_id: user.id,
          status: 'assigned',
          assignment_method: 'round_robin',
          assigned_at: now,
          priority: 'normal',
          lock_version: 1,
        });
        created.push(assignment);
      }
    } else {
      return Response.json({ error: `Unknown method: ${method}` }, { status: 400 });
    }

    // Update campaign assigned_user_ids
    const allAssignedUsers = [...new Set([
      ...(campaign.assigned_user_ids || []),
      ...validUserIds,
    ])];
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      assigned_user_ids: allAssignedUsers,
    });

    return Response.json({ created: created.length, assignments: created.map((a) => ({ id: a.id, company_id: a.company_id, assigned_user_id: a.assigned_user_id })) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}