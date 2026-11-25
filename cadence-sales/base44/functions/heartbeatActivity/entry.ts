import { resolveTenant } from '../../shared/tenantAuth.ts';

// Lightweight activity pulse from Dialer / Today so BDMs can see live SDR status.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const status = ['idle', 'in_call', 'logging', 'offline'].includes(body.status)
      ? body.status
      : 'idle';
    const detail = String(body.detail || '').slice(0, 120);

    const profiles = await base44.asServiceRole.entities.UserProfile.filter(
      { organisation_id: org.id, user_id: user.id },
      '-created_date',
      1,
    ).catch(() => []);
    const row = profiles && profiles[0];
    if (!row) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    await base44.asServiceRole.entities.UserProfile.update(row.id, {
      activity_status: status,
      last_activity_at: new Date().toISOString(),
      activity_detail: detail,
    });

    return Response.json({ ok: true, status, role: profile.app_role });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
