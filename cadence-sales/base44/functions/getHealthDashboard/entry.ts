import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const [
      recentErrors, recentWarnings, billingEvents, usageEvents,
      handoffAttempts, callLogs, tasks, suppressionEntries
    ] = await Promise.all([
      base44.asServiceRole.entities.OperationalEvent.filter(
        { organisation_id: org.id, severity: { $in: ['error', 'critical'] } }, '-occurred_at', 20
      ),
      base44.asServiceRole.entities.OperationalEvent.filter(
        { organisation_id: org.id, severity: 'warning' }, '-occurred_at', 10
      ),
      base44.asServiceRole.entities.BillingEvent.filter({ organisation_id: org.id }, '-created_at', 5),
      base44.asServiceRole.entities.UsageEvent.filter({ organisation_id: org.id }, '-occurred_at', 10),
      base44.asServiceRole.entities.HandoffAttempt.filter({ organisation_id: org.id }, '-created_at', 10),
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: org.id }, '-created_date', 5),
      base44.asServiceRole.entities.Task.filter({ organisation_id: org.id }, '-created_date', 5),
      base44.asServiceRole.entities.SuppressionEntry.filter({ organisation_id: org.id }, '-created_at', 5),
    ]);

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentErrorCount = recentErrors.filter(e => {
      const t = e.occurred_at ? new Date(e.occurred_at).getTime() : 0;
      return t > oneHourAgo;
    }).length;

    const health = (status) => ({ status, last_checked: new Date().toISOString() });

    const services = {
      authentication: health(recentErrors.some(e => e.category === 'auth') ? 'degraded' : 'operational'),
      database: health('operational'),
      today_queue: health(tasks.length > 0 ? 'operational' : 'unknown'),
      outcome_processing: health(callLogs.length > 0 ? 'operational' : 'unknown'),
      callback_creation: health(tasks.some(t => t.task_type === 'callback') ? 'operational' : 'unknown'),
      twilio: health('unknown'),
      billing: health(billingEvents.length > 0 ? 'operational' : 'unknown'),
      reports: health(callLogs.length > 0 ? 'operational' : 'unknown'),
      crm_webhooks: health(handoffAttempts.length > 0 ? 'operational' : 'unknown'),
      scheduled_jobs: health('unknown'),
      usage_ledger: health(usageEvents.length > 0 ? 'operational' : 'unknown'),
    };

    // Twilio: check provider credentials
    try {
      const creds = await base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: org.id, provider: 'twilio' });
      if (creds.length > 0) {
        services.twilio = health(creds[0].status === 'active' ? 'operational' : 'degraded');
      }
    } catch { /* leave unknown */ }

    const degradedCount = Object.values(services).filter(s => s.status === 'degraded').length;
    const disruptedCount = Object.values(services).filter(s => s.status === 'disrupted').length;
    const unknownCount = Object.values(services).filter(s => s.status === 'unknown').length;

    const overall = disruptedCount > 0 ? 'disrupted' : degradedCount > 0 ? 'degraded' : unknownCount > 3 ? 'unknown' : 'operational';

    return Response.json({
      overall_status: overall,
      services,
      recent_errors: recentErrors.slice(0, 10).map(e => ({
        severity: e.severity,
        category: e.category,
        message: e.safe_message,
        occurred_at: e.occurred_at,
        resolved: !!e.resolved_at,
      })),
      recent_warnings: recentWarnings.slice(0, 5).map(e => ({
        category: e.category,
        message: e.safe_message,
        occurred_at: e.occurred_at,
      })),
      error_count_last_hour: recentErrorCount,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}