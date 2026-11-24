import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { FEATURES } from '../../shared/entitlements.ts';
import { guardAction, commitReservation, releaseReservation } from '../../shared/costGuard.ts';

const ACTIONS = {
  brief_extraction: { feature: FEATURES.research, event_type: 'ai_action' },
  icp_extraction: { feature: FEATURES.research, event_type: 'ai_action' },
  contact_organisation: { feature: FEATURES.ai_summaries, event_type: 'ai_action' },
  company_discovery: { feature: FEATURES.research, event_type: 'ai_action', use_web_search: true },
};

export default async function (req) {
  let base44;
  let reservation;
  try {
    const tenant = await resolveTenant(req);
    base44 = tenant.base44;
    const { user, profile, org } = tenant;
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const action = ACTIONS[body.action_type];

    if (!action) return Response.json({ error: 'Unsupported Smart Action.' }, { status: 400 });
    const prompt = String(body.prompt || '').trim();
    if (!prompt || prompt.length > 30000) {
      return Response.json({ error: 'Smart Action prompt must be between 1 and 30,000 characters.' }, { status: 400 });
    }

    const fileUrls = Array.isArray(body.file_urls) ? body.file_urls.slice(0, 3) : [];
    const guarded = await guardAction(
      base44, user, profile, org, action.feature, 1,
      body.idempotency_key || `${org.id}:${body.action_type}:${crypto.randomUUID()}`
    );
    reservation = guarded.reservation;

    const request = {
      prompt,
      model: 'gemini_3_flash',
      ...(action.use_web_search ? { add_context_from_internet: true } : {}),
      ...(fileUrls.length ? { file_urls: fileUrls } : {}),
      ...(body.response_json_schema ? { response_json_schema: body.response_json_schema } : {}),
    };
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(request);

    await commitReservation(base44, reservation.id, {
      event_type: action.event_type,
      provider: 'base44_ai',
      quantity: 1,
      unit: 'smart_action',
      source_function: 'runSmartAction',
      metadata: { action_type: body.action_type },
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    return Response.json({ result });
  } catch (error) {
    if (base44 && reservation?.id) {
      await releaseReservation(base44, reservation.id, error.message).catch(() => {});
    }
    return Response.json({ error: error.message || 'Smart Action failed.' }, { status: error.status || 500 });
  }
}