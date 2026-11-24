import { resolveTenant } from '../../shared/tenantAuth.ts';

// Role-aware organisation onboarding. Every tenant user can view their own
// relevant steps. Admin-only setup is reported to SDRs without linking them to
// inaccessible pages or blocking core workflow.
export default async function(req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    const isAdmin = ['platform_owner', 'organisation_admin'].includes(profile.app_role);
    const isManager = isAdmin || profile.app_role === 'sales_manager';

    const [milestones, pilot, campaigns, complianceSettings, providerCreds, userProfiles] = await Promise.all([
      base44.asServiceRole.entities.PilotMilestone.filter({ organisation_id: org.id }, '-created_at', 50),
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: org.id }),
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: org.id }, '-created_date', 50),
      base44.asServiceRole.entities.ComplianceSettings.filter({ organisation_id: org.id }),
      base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: org.id }),
      base44.asServiceRole.entities.UserProfile.filter({ organisation_id: org.id }),
    ]);

    const milestoneKeys = new Set(milestones.map(m => m.milestone_key));
    const apiSkipped = org.settings?.onboarding_api_skipped === true;
    const allSteps = [
      { key: 'confirm_details', milestone: 'org_setup_completed', label: 'Confirm organisation details', audience: 'admin', completed: milestoneKeys.has('org_setup_completed') },
      { key: 'privacy_settings', milestone: null, label: 'Review privacy and calling settings', audience: 'admin', completed: complianceSettings.length > 0 },
      { key: 'connect_telephony', milestone: 'telephony_connected', label: 'Connect a calling provider', audience: 'admin', optional: true, skipped: apiSkipped, completed: milestoneKeys.has('telephony_connected') || providerCreds.length > 0 },
      { key: 'test_call', milestone: 'first_test_call', label: 'Make a test call', audience: 'admin', completed: milestoneKeys.has('first_test_call') },
      { key: 'invite_team', milestone: 'first_caller_invited', label: 'Invite the calling team', audience: 'admin', completed: milestoneKeys.has('first_caller_invited') || userProfiles.filter(p => p.status !== 'disabled').length > 1 },
      { key: 'create_campaign', milestone: 'first_campaign_activated', label: 'Create the first campaign', audience: 'manager', completed: milestoneKeys.has('first_campaign_activated') || campaigns.length > 0 },
      { key: 'first_call', milestone: 'first_real_call', label: 'Complete your first real call', audience: 'caller', completed: milestoneKeys.has('first_real_call') },
      { key: 'first_callback', milestone: 'first_callback', label: 'Schedule your first callback', audience: 'caller', completed: milestoneKeys.has('first_callback') },
      { key: 'view_results', milestone: null, label: 'View your results', audience: 'caller', completed: false },
      { key: 'first_report', milestone: 'first_client_report', label: 'Generate the first client report', audience: 'manager', completed: milestoneKeys.has('first_client_report') },
    ];

    const visibleSteps = allSteps.filter(step =>
      step.audience === 'caller' || (step.audience === 'manager' && isManager) || (step.audience === 'admin' && isAdmin)
    );
    const completedSteps = visibleSteps.filter(s => s.completed || s.skipped).length;

    return Response.json({
      organisation: { id: org.id, name: org.name, pilot_status: org.pilot_status },
      role: { app_role: profile.app_role, is_admin: isAdmin, is_manager: isManager },
      pilot: pilot[0] || null,
      onboarding: {
        steps: visibleSteps,
        completed_count: completedSteps,
        total_steps: visibleSteps.length,
        progress_percent: visibleSteps.length ? Math.round((completedSteps / visibleSteps.length) * 100) : 100,
        workspace_setup_complete: complianceSettings.length > 0 && providerCreds.length > 0,
        api_setup_skipped: apiSkipped,
      },
      checks: {
        compliance_configured: complianceSettings.length > 0,
        telephony_configured: providerCreds.length > 0,
        campaign_created: campaigns.length > 0,
        team_members: userProfiles.filter(p => p.status !== 'disabled').length,
      },
      milestones: Array.from(milestoneKeys),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
