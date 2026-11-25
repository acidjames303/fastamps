import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getComplianceSettings, complianceStatusLabel } from '../../shared/complianceUtils.ts';

// Returns compliance dashboard data for organisation admins.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const settings = await getComplianceSettings(base44, org);

    // Fetch contacts for compliance aggregation
    const contacts = await base44.asServiceRole.entities.Contact.filter(
      { organisation_id: org.id }, '-created_date', 5000
    ).catch(() => []);

    const stats = {
      ready_for_calling: contacts.filter(c => !c.do_not_call && !c.deleted_at && !c.anonymised_at &&
        c.marketing_status === 'permitted' &&
        c.compliance_review_status !== 'review_required' &&
        c.compliance_review_status !== 'flagged').length,
      review_required: contacts.filter(c =>
        c.compliance_review_status === 'review_required' ||
        c.compliance_review_status === 'flagged' ||
        c.screening_status === 'check_expired' ||
        c.screening_status === 'review_required').length,
      suppressed: contacts.filter(c => c.do_not_call || (c.suppression_scope && c.suppression_scope !== 'none') ||
        c.marketing_status === 'suppressed' || c.marketing_status === 'objected').length,
      not_checked: contacts.filter(c => (!c.marketing_status || c.marketing_status === 'unknown') &&
        (!c.compliance_review_status || c.compliance_review_status === 'not_reviewed')).length,
      total_contacts: contacts.filter(c => !c.deleted_at && !c.anonymised_at).length,
    };

    // Suppression entries
    const suppressions = await base44.asServiceRole.entities.SuppressionEntry.filter(
      { organisation_id: org.id }, '-created_date', 500
    ).catch(() => []);

    const suppressionStats = {
      total: suppressions.length,
      active: suppressions.filter(s => s.status === 'active').length,
      overridden: suppressions.filter(s => s.status === 'overridden').length,
      recent_overrides: suppressions
        .filter(s => s.status === 'overridden')
        .sort((a, b) => (b.overridden_at || '').localeCompare(a.overridden_at || ''))
        .slice(0, 10)
        .map(s => ({
          id: s.id,
          reason: s.override_reason || '',
          overridden_at: s.overridden_at,
          suppression_type: s.suppression_type,
        })),
    };

    // Privacy requests
    const privacyRequests = await base44.asServiceRole.entities.PrivacyRequest.filter(
      { organisation_id: org.id }, '-created_date', 100
    ).catch(() => []);

    const now = new Date();
    const privacyStats = {
      total: privacyRequests.length,
      active: privacyRequests.filter(r => !['completed', 'rejected', 'cancelled'].includes(r.status)).length,
      approaching_due: privacyRequests.filter(r => {
        if (['completed', 'rejected', 'cancelled'].includes(r.status)) return false;
        if (!r.due_at) return false;
        const daysUntilDue = (new Date(r.due_at).getTime() - now.getTime()) / 86400000;
        return daysUntilDue <= 7 && daysUntilDue >= 0;
      }).length,
      overdue: privacyRequests.filter(r => {
        if (['completed', 'rejected', 'cancelled'].includes(r.status)) return false;
        if (!r.due_at) return false;
        return new Date(r.due_at).getTime() < now.getTime();
      }).length,
    };

    // Expired screening checks
    const expiredScreening = contacts.filter(c =>
      c.screening_status === 'check_expired' ||
      (c.screening_expires_at && new Date(c.screening_expires_at).getTime() < now.getTime())
    ).length;

    // Retention review due
    const retentionDue = contacts.filter(c =>
      c.retention_review_at && new Date(c.retention_review_at).getTime() < now.getTime()
    ).length;

    // Recordings approaching deletion
    const recordings = await base44.asServiceRole.entities.CallRecording.filter(
      { organisation_id: org.id }, '-created_date', 500
    ).catch(() => []);
    const recordingStats = {
      total: recordings.length,
      approaching_deletion: recordings.filter(r =>
        r.retention_expires_at &&
        new Date(r.retention_expires_at).getTime() < now.getTime() + 7 * 86400000 &&
        r.deletion_status === 'not_requested'
      ).length,
      pending_deletion: recordings.filter(r => ['requested', 'pending'].includes(r.deletion_status)).length,
      failed_deletion: recordings.filter(r => r.deletion_status === 'failed').length,
    };

    return Response.json({
      compliance_notice: settings.compliance_notice,
      recording_enabled: settings.recording_enabled,
      stats,
      suppression: suppressionStats,
      privacy: privacyStats,
      expired_screening: expiredScreening,
      retention_due: retentionDue,
      recordings: recordingStats,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}