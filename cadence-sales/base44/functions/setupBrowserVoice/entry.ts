import { resolveTenant } from '../../shared/tenantAuth.ts';
import { saveOrgCredentials } from '../../shared/providerCredentials.ts';
import { loadTwilioVoiceConfig } from '../../shared/twilioVoice.ts';

// Prepares the organisation for calling from inside the browser (WebRTC), which
// is what makes the on-screen keypad able to send DTMF tones into a live call.
// Uses the org's existing Account SID + Auth Token to create the API Key pair and
// the TwiML App that points at twilioVoiceTwiML, then stores them encrypted.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Only organisation admins can enable in-app calling.' }, { status: 403 });
    }

    const config = await loadTwilioVoiceConfig(base44, org);
    const { accountSid, authToken } = config;
    let apiKeySid = config.apiKeySid;
    let apiKeySecret = config.apiKeySecret;
    let twimlAppSid = config.twimlAppSid;

    if (!accountSid || !authToken) {
      return Response.json({ error: 'Connect Twilio first — the Account SID and Auth Token are needed.' }, { status: 400 });
    }

    const origin = req.headers.get('X-Base44-App-Url') || 'https://evasive-dial-flow-go.base44.app';
    const voiceUrl = `${origin.replace(/\/$/, '')}/functions/twilioVoiceTwiML`;
    const authHeader = 'Basic ' + btoa(accountSid + ':' + authToken);
    const toSave = {};
    const created = [];

    // 1. API Key pair for minting browser Voice SDK tokens.
    if (!apiKeySid || !apiKeySecret) {
      const body = new URLSearchParams();
      body.set('FriendlyName', `Cadence Browser Calling ${new Date().toISOString().split('T')[0]}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys.json`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error('setupBrowserVoice key error', res.status);
        return Response.json({ error: `Twilio rejected the API key request (HTTP ${res.status}). Check the Account SID and Auth Token.` }, { status: 400 });
      }
      const data = await res.json();
      apiKeySid = data.sid;
      apiKeySecret = data.secret;
      if (!apiKeySid || !apiKeySecret) {
        return Response.json({ error: 'Twilio did not return an API key.' }, { status: 500 });
      }
      toSave.TWILIO_API_KEY_SID = apiKeySid;
      toSave.TWILIO_API_KEY_SECRET = apiKeySecret;
      created.push('api_key');
    }

    // 2. TwiML App that the browser call points at.
    const appBody = new URLSearchParams();
    appBody.set('FriendlyName', 'Cadence Browser Calling');
    appBody.set('VoiceUrl', voiceUrl);
    appBody.set('VoiceMethod', 'POST');

    if (twimlAppSid) {
      const check = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`, {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(15000),
      });
      if (check.ok) {
        // Keep the webhook pointed at this app.
        const upd = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: appBody.toString(),
          signal: AbortSignal.timeout(15000),
        });
        if (!upd.ok) console.error('setupBrowserVoice app update failed', upd.status);
      } else {
        twimlAppSid = '';
      }
    }

    if (!twimlAppSid) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications.json`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: appBody.toString(),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error('setupBrowserVoice app create failed', res.status);
        return Response.json({ error: `Twilio rejected the TwiML App request (HTTP ${res.status}).` }, { status: 400 });
      }
      const app = await res.json();
      twimlAppSid = app.sid;
      toSave.TWILIO_TWIML_APP_SID = twimlAppSid;
      created.push('twiml_app');
    }

    if (Object.keys(toSave).length) {
      await saveOrgCredentials(base44, org, user.id, 'twilio', toSave);
    }

    return Response.json({ ok: true, browserVoice: true, created, voice_url: voiceUrl });
  } catch (error) {
    console.error('setupBrowserVoice error:', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}