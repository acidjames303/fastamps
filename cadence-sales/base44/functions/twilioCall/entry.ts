import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';
import { isNumberSuppressed } from '../../shared/doNotCall.ts';
import { escapeXml, normaliseDialNumber, isCallSid } from '../../shared/twiml.ts';

// Twilio click-to-dial over the REST API. Each org connects its own Account SID +
// Auth Token + caller number via the Settings page. Credentials are now stored
// encrypted in the ProviderCredential entity, never on Organisation.settings.
const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

function basic(sid, token) {
  return 'Basic ' + btoa(`${sid}:${token}`);
}

export default async function (req) {
  try {
    const { base44, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { action, destination: rawDestination, agent: rawAgent, call_sid } = body || {};

    const k = await getOrgCredentials(base44, org);
    const sid = (k.get('TWILIO_ACCOUNT_SID') || '').trim();
    const token = (k.get('TWILIO_AUTH_TOKEN') || '').trim();
    const from = (k.get('TWILIO_FROM_NUMBER') || '').trim();

    if (!sid || !token) {
      return Response.json({ error: 'Twilio credentials not configured. Connect them in Settings.' }, { status: 400 });
    }

    if (action === 'dial') {
      // Both numbers are validated as plain dialable numbers first: raw request
      // values must never reach the TwiML document (XML injection).
      const destination = normaliseDialNumber(rawDestination);
      const agent = normaliseDialNumber(rawAgent);
      if (!destination) return Response.json({ error: 'destination (contact number) required' }, { status: 400 });
      if (!agent) return Response.json({ error: 'agent (your real phone number) required' }, { status: 400 });
      if (!from) return Response.json({ error: 'TWILIO_FROM_NUMBER not configured' }, { status: 400 });

      // A do-not-call request blocks the number itself, so it cannot be dialled
      // even if someone types it in by hand.
      if (await isNumberSuppressed(base44, org.id, destination)) {
        return Response.json({ error: 'This number is on the do-not-call list and cannot be dialled.' }, { status: 403 });
      }

      const twiml = `<Response><Dial callerId="${escapeXml(from)}">${escapeXml(destination)}</Dial></Response>`;
      const form = new URLSearchParams();
      form.append('To', agent);
      form.append('From', from);
      form.append('Twiml', twiml);

      const res = await fetch(`${TWILIO_API}/${sid}/Calls.json`, {
        method: 'POST',
        headers: { Authorization: basic(sid, token), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return Response.json({ error: 'Twilio dial failed', status: res.status, detail: data }, { status: 502 });
      }
      return Response.json({ call_uuid: data.sid, raw: data });
    }

    if (action === 'hangup') {
      // Only a real call SID may enter the API path — no traversal segments.
      if (!isCallSid(call_sid)) return Response.json({ error: 'call_sid required' }, { status: 400 });
      const res = await fetch(`${TWILIO_API}/${sid}/Calls/${call_sid}.json`, {
        method: 'DELETE',
        headers: { Authorization: basic(sid, token) },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return Response.json({ error: 'Twilio hangup failed', status: res.status, detail: data }, { status: 502 });
      }
      return Response.json({ hung_up: true });
    }

    if (action === 'test_auth') {
      const res = await fetch(`${TWILIO_API}/${sid}.json`, { headers: { Authorization: basic(sid, token) } });
      return Response.json({ status: res.status });
    }

    return Response.json({ error: 'unknown action; use "dial" or "hangup"' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}