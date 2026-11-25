import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getOrgCredentials, saveOrgCredentials } from '../../shared/providerCredentials.ts';

// Rotates the Twilio API Key pair used for browser Voice SDK tokens.
// Uses the org's valid Account SID + Auth Token to create a new API Key,
// then saves the new SID + Secret to the encrypted ProviderCredential store.
// Platform owners only. Also verifies the TwiML App SID is valid.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (profile.app_role !== 'platform_owner') {
      return Response.json({ error: 'Only platform owners can rotate Twilio API keys.' }, { status: 403 });
    }

    const k = await getOrgCredentials(base44, org);
    const accountSid = (k.get('TWILIO_ACCOUNT_SID') || '').trim();
    const authToken = (k.get('TWILIO_AUTH_TOKEN') || '').trim();
    const oldApiKeySid = (k.get('TWILIO_API_KEY_SID') || '').trim();
    const twimlAppSid = (k.get('TWILIO_TWIML_APP_SID') || '').trim();

    if (!accountSid || !authToken) {
      return Response.json({ error: 'Twilio Account SID and Auth Token must be configured first.' }, { status: 400 });
    }

    const authHeader = 'Basic ' + btoa(accountSid + ':' + authToken);

    // 1. Verify account credentials are valid
    const accountRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: authHeader },
    });
    if (!accountRes.ok) {
      return Response.json({ error: `Account credentials invalid (HTTP ${accountRes.status}).` }, { status: 400 });
    }

    // 2. Verify TwiML App SID exists
    if (twimlAppSid) {
      const appRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`, {
        headers: { Authorization: authHeader },
      });
      if (!appRes.ok) {
        return Response.json({ error: `TwiML App SID not found (HTTP ${appRes.status}). Create a TwiML App in Twilio Console first.` }, { status: 400 });
      }
    }

    // 3. Create a new API Key
    const keyBody = new URLSearchParams();
    keyBody.set('FriendlyName', `Cadence Voice SDK ${new Date().toISOString().split('T')[0]}`);
    const keyRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys.json`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: keyBody.toString(),
    });
    if (!keyRes.ok) {
      const errText = await keyRes.text().catch(() => '');
      return Response.json({ error: `Failed to create API Key (HTTP ${keyRes.status}). ${errText}` }, { status: 400 });
    }
    const keyData = await keyRes.json();
    const newApiKeySid = keyData.sid;
    const newApiKeySecret = keyData.secret;

    if (!newApiKeySid || !newApiKeySecret) {
      return Response.json({ error: 'Twilio did not return a valid API Key SID or Secret.' }, { status: 500 });
    }

    // 4. Save the new API Key pair to the encrypted ProviderCredential store
    const result = await saveOrgCredentials(base44, org, user.id, 'twilio', {
      TWILIO_API_KEY_SID: newApiKeySid,
      TWILIO_API_KEY_SECRET: newApiKeySecret,
    });

    // 5. Optionally suspend the old API Key (best-effort, non-blocking)
    if (oldApiKeySid && oldApiKeySid !== newApiKeySid) {
      try {
        const suspendBody = new URLSearchParams();
        suspendBody.set('Status', 'suspended');
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys/${oldApiKeySid}.json`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: suspendBody.toString(),
        });
      } catch {
        // Non-fatal — old key may already be invalid
      }
    }

    return Response.json({
      ok: true,
      message: 'Twilio API Key rotated successfully. Browser Voice SDK should now work.',
      new_api_key_sid: newApiKeySid.slice(-4),
      old_api_key_suspended: !!oldApiKeySid && oldApiKeySid !== newApiKeySid,
      connected: result.connected,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}