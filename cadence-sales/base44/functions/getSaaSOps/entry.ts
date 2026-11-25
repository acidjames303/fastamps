import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getPlatformCreditEstimate, getUsageByOrganisation } from '../../shared/usageLedger.ts';

// Returns platform-level SaaS operations data for the platform owner dashboard.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (profile.app_role !== 'platform_owner') {
      return Response.json({ error: 'Platform owner access required' }, { status: 403 });
    }

    // Fetch all organisations
    const organisations = await base44.asServiceRole.entities.Organisation.list('-created_date', 500).catch(() => []);
    const orgIds = organisations.map(o => o.id);

    // Fetch all subscriptions
    const allSubs = await base44.asServiceRole.entities.OrganisationSubscription.list('-created_date', 500).catch(() => []);

    // Fetch all user profiles for seat counting
    const allProfiles = await base44.asServiceRole.entities.UserProfile.list('-created_date', 1000).catch(() => []);

    // Fetch recent operational events
    const recentEvents = await base44.asServiceRole.entities.OperationalEvent.list('-occurred_at', 20).catch(() => []);

    // Platform credit estimate
    const credits = await getPlatformCreditEstimate(base44);

    // Usage by organisation for current month
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const usageByOrg = await getUsageByOrganisation(base44, monthStart);

    // Build org summaries
    const orgSummaries = organisations.map(o => {
      const sub = allSubs.find(s => s.organisation_id === o.id && ['trialing', 'active', 'past_due', 'grace_period'].includes(s.status));
      const orgProfiles = allProfiles.filter(p => p.organisation_id === o.id && p.status === 'active');
      const usage = usageByOrg.find(u => u.organisation_id === o.id);
      return {
        id: o.id,
        name: o.name,
        status: o.status,
        plan_code: sub?.plan_code || 'none',
        subscription_status: sub?.status || 'none',
        active_users: orgProfiles.length,
        total_usage: usage?.total || 0,
        trial_end: sub?.trial_end || null,
        current_period_end: sub?.current_period_end || null,
      };
    });

    // Summary counts
    const summary = {
      total_organisations: organisations.length,
      active: organisations.filter(o => o.status === 'active').length,
      suspended: organisations.filter(o => o.status === 'suspended').length,
      cancelled: organisations.filter(o => o.status === 'cancelled').length,
      trialing: orgSummaries.filter(o => o.subscription_status === 'trialing').length,
      paying: orgSummaries.filter(o => ['active', 'past_due', 'grace_period'].includes(o.subscription_status)).length,
      total_active_users: allProfiles.filter(p => p.status === 'active').length,
    };

    return Response.json({
      summary,
      credits,
      organisations: orgSummaries,
      recent_events: recentEvents.map(e => ({
        id: e.id,
        severity: e.severity,
        category: e.category,
        safe_message: e.safe_message,
        organisation_id: e.organisation_id,
        source_function: e.source_function,
        occurred_at: e.occurred_at,
        resolved_at: e.resolved_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}