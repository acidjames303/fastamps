import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';

const YAY_API = 'https://api.yay.com';
// Fallback SIP user (platform default) used when an organisation hasn't set its own.
const FALLBACK_SIP_USER_UUID = '3a0886de-aaea-4b86-afab-6842b8ae4ba6';

export default async function(req) {
  try {
    const { base44, org } = await resolveTenant(req);
    const k = await getOrgCredentials(base44, org);

    const body = await req.json().catch(() => ({}));
    const { action, destination, call_uuid } = body || {};

    const authHeaders = {
      'X-Auth-Reseller': (k.get('YAY_RESELLER') || '').trim(),
      'X-Auth-User': (k.get('YAY_USER') || '').trim(),
      'X-Auth-Password': (k.get('YAY_PASSWORD') || '').trim(),
      'User-Agent': 'DialFlow-AI/1.0',
      'Content-Type': 'application/json',
    };
    const sipUserUuid = (k.get('YAY_SIP_USER_UUID') || '').trim() || FALLBACK_SIP_USER_UUID;

    if (action === 'dial') {
      if (!destination) return Response.json({ error: 'destination required' }, { status: 400 });
      const res = await fetch(`${YAY_API}/voip/call`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ sip_user: sipUserUuid, destination }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return Response.json({ error: 'Yay dial failed', status: res.status, detail: data }, { status: 502 });
      }
      const uuid = data.uuid || data.call_uuid || data.id || data.request_uuid;
      return Response.json({ call_uuid: uuid, raw: data });
    }

    if (action === 'egress') {
      const r = await fetch('https://api.ipify.org?format=json');
      const d = await r.json().catch(() => ({}));
      return Response.json({ ip: d.ip });
    }

    if (action === 'test_auth') {
      const res = await fetch(`${YAY_API}/authenticated`, { headers: authHeaders });
      const text = await res.text();
      return Response.json({ status: res.status, headers: Object.fromEntries(res.headers), body: text });
    }

    if (action === 'hangup') {
      if (!call_uuid) return Response.json({ error: 'call_uuid required' }, { status: 400 });
      const res = await fetch(`${YAY_API}/voip/call/${call_uuid}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return Response.json({ error: 'Yay hangup failed', status: res.status, detail: data }, { status: 502 });
      }
      return Response.json({ hung_up: true });
    }

    return Response.json({ error: 'unknown action; use "dial" or "hangup"' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}