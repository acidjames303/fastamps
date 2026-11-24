import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';

// Submit a support request with safe diagnostics.
// Never includes credentials, tokens, full notes, or other orgs' data.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const body = await req.json().catch(() => ({}));
    const { title, description, category, priority, page, related_entity_type, related_entity_id, customer_impact } = body;

    if (!title || !category) {
      return Response.json({ error: 'Title and category are required.' }, { status: 400 });
    }

    // Safe diagnostics — only non-sensitive browser/system info
    const safeDiagnostics = {
      app_version: body.app_version || 'unknown',
      page: page || '',
      browser: body.browser || '',
      timestamp: new Date().toISOString(),
      organisation_id: org.id,
      user_id: user.id,
      correlation_id: body.correlation_id || `sr-${Date.now()}`,
    };

    const request = await base44.asServiceRole.entities.SupportRequest.create({
      organisation_id: org.id,
      submitted_by_user_id: user.id,
      category,
      priority: priority || 'normal',
      status: 'new',
      title,
      description: description || '',
      page: page || '',
      app_version: safeDiagnostics.app_version,
      correlation_id: safeDiagnostics.correlation_id,
      related_entity_type: related_entity_type || '',
      related_entity_id: related_entity_id || '',
      safe_diagnostics: safeDiagnostics,
      customer_impact: customer_impact || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return Response.json({
      id: request.id,
      status: 'created',
      correlation_id: safeDiagnostics.correlation_id,
      message: 'Support request submitted. We will acknowledge it within the target response time.',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}