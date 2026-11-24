import { resolveTenant } from '../../shared/tenantAuth.ts';
import { loadTwilioVoiceConfig, mintAccessToken, signVoiceToken } from '../../shared/twilioVoice.ts';

// Mints a Twilio browser Voice SDK access token for the caller's organisation.
// Also returns a short-lived voice token the browser forwards to the TwiML
// webhook so it can authenticate the outbound call. Credentials are loaded
// from the encrypted ProviderCredential store (never from Organisation.settings).
export default async function (req) {
  try {
    const { base44, org } = await resolveTenant(req);
    const { accountSid, authToken, apiKeySid, apiKeySecret, twimlAppSid } = await loadTwilioVoiceConfig(base44, org);

    if (!accountSid || !authToken || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return Response.json({ error: 'Twilio browser-voice credentials not configured. Add the API Key SID, API Key Secret and TwiML App SID in Settings.' }, { status: 400 });
    }

    const identity = 'org-' + (org.id || 'anon');
    const token = await mintAccessToken({ apiKeySid, apiKeySecret, accountSid, twimlAppSid, identity });
    const voiceToken = await signVoiceToken(authToken, org.id);

    return Response.json({ token, voiceToken });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}