import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';
import { verifyVoiceToken } from '../../shared/twilioVoice.ts';
import { isNumberSuppressed } from '../../shared/doNotCall.ts';
import { escapeXml, normaliseDialNumber } from '../../shared/twiml.ts';

// Public TwiML webhook called by Twilio's servers when the browser Voice SDK
// connects an outbound call. Twilio POSTs the form-encoded connect params
// (To = destination, vt = voice token). The voice token binds the call to an
// org and is HMAC-signed with that org's auth token, so only calls minted by
// our authenticated token function are honoured — no user auth available here.
export default async function (req) {
  const say = (msg) => new Response(`<Response><Say>${escapeXml(msg)}</Say></Response>`, { headers: { 'Content-Type': 'text/xml' } });
  try {
    const form = await req.formData();
    // The connect parameter is caller-controlled: accept a plain dialable number
    // only, so no TwiML can be injected into the response below.
    const to = normaliseDialNumber((form.get('To') || '').toString());
    const vt = (form.get('vt') || '').toString().trim();
    if (!to) return say('Destination number missing or invalid.');
    if (!vt) {
      console.error('twilioVoiceTwiML: no voice token on connect', JSON.stringify(Array.from(form.keys())));
      return say('Unauthorized.');
    }

    // Peek the org id from the token body (untrusted until verified below).
    const [bodyB64] = vt.split('.');
    let orgId = '';
    try { orgId = JSON.parse(atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/'))).o || ''; } catch {}
    if (!orgId) return say('Unauthorized.');

    const base44 = createClientFromRequest(req);
    const org = await base44.asServiceRole.entities.Organisation.get(orgId).catch(() => null);
    if (!org) return say('Unauthorized.');

    // Load encrypted credentials (server-side only).
    const creds = await getOrgCredentials(base44, org);
    const authToken = (creds.get('TWILIO_AUTH_TOKEN') || '').trim();
    const from = (creds.get('TWILIO_FROM_NUMBER') || '').trim();

    const body = await verifyVoiceToken(authToken, vt);
    if (!body || !from) {
      console.error('twilioVoiceTwiML: token check failed', { hasBody: !!body, hasFrom: !!from, orgId });
      return say('Unauthorized.');
    }

    // Do-not-call numbers are blocked at the telephony layer, not just in the UI.
    if (await isNumberSuppressed(base44, org.id, to)) {
      return say('This number is on the do-not-call list and cannot be dialled.');
    }

    const twiml = `<Response><Dial callerId="${escapeXml(from)}"><Number>${escapeXml(to)}</Number></Dial></Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (error) {
    console.error('twilioVoiceTwiML error:', error?.message || error);
    return say('Error. ' + (error?.message || 'unknown'));
  }
}