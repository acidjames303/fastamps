import { resolveTenant } from '../../shared/tenantAuth.ts';
import { saveOrgCredentials, getConnectionStatus } from '../../shared/providerCredentials.ts';
import {
  buildAuthorizeUrl,
  createGmailDraft,
  createOutlookDraft,
  createPkceVerifier,
  decryptTokens,
  pkceChallenge,
  encryptTokens,
  exchangeCodeForTokens,
  fetchMailboxAddress,
  getFreshAccessToken,
  getOAuthClient,
  scopesFor,
} from '../../shared/emailMailbox.ts';

// Per-user Gmail / Outlook mailbox connect + draft creation.
// Never auto-sends. OAuth client credentials are org-admin only.
function verifyRedirectOrigin(req, redirectUri) {
  try {
    const target = new URL(redirectUri);
    const origin = req.headers.get('origin');
    if (!origin) return false; // Fail closed; browser SDK sends Origin on POST.
    const caller = new URL(origin);
    const isLocal = target.hostname === 'localhost' && caller.hostname === 'localhost';
    if (target.origin !== caller.origin || target.username || target.password || target.search || target.hash) return false;
    return (target.protocol === 'https:' || (isLocal && target.protocol === 'http:'))
      && target.pathname === '/email-connect/callback';
  } catch { return false; }
}
const PENDING_OAUTH_TTL_MS = 10 * 60 * 1000;
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    if (action === 'status') {
      const connections = await base44.asServiceRole.entities.EmailMailboxConnection.filter(
        { organisation_id: org.id, user_id: user.id, status: 'active' },
        '-connected_at',
        10,
      ).catch(() => []);

      const gmailOauth = await getOAuthClient(base44, org, 'gmail');
      const outlookOauth = await getOAuthClient(base44, org, 'outlook');

      return Response.json({
        providers: {
          gmail: {
            org_configured: gmailOauth.configured,
            connected: !!(connections || []).find((c) => c.provider === 'gmail'),
            email: (connections || []).find((c) => c.provider === 'gmail')?.email_address || '',
          },
          outlook: {
            org_configured: outlookOauth.configured,
            connected: !!(connections || []).find((c) => c.provider === 'outlook'),
            email: (connections || []).find((c) => c.provider === 'outlook')?.email_address || '',
          },
        },
        can_manage_oauth: ['platform_owner', 'organisation_admin'].includes(profile.app_role),
      });
    }

    if (action === 'save_oauth_client') {
      if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
        return Response.json({ error: 'Only organisation admins can configure email OAuth.' }, { status: 403 });
      }
      const provider = body.provider;
      if (provider !== 'gmail' && provider !== 'outlook') {
        return Response.json({ error: 'provider must be gmail or outlook' }, { status: 400 });
      }
      const keys = {};
      if (provider === 'gmail') {
        if (body.client_id !== undefined) keys.GMAIL_OAUTH_CLIENT_ID = body.client_id || '';
        if (body.client_secret) keys.GMAIL_OAUTH_CLIENT_SECRET = body.client_secret;
      } else {
        if (body.client_id !== undefined) keys.OUTLOOK_OAUTH_CLIENT_ID = body.client_id || '';
        if (body.client_secret) keys.OUTLOOK_OAUTH_CLIENT_SECRET = body.client_secret;
      }
      await saveOrgCredentials(base44, org, user.id, provider, keys);
      const status = await getConnectionStatus(base44, org);
      return Response.json({ ok: true, connected: status.connected });
    }

    if (action === 'start_connect') {
      const provider = body.provider;
      if (provider !== 'gmail' && provider !== 'outlook') {
        return Response.json({ error: 'provider must be gmail or outlook' }, { status: 400 });
      }
      const oauth = await getOAuthClient(base44, org, provider);
      if (!oauth.configured) {
        return Response.json({
          error: `${provider === 'gmail' ? 'Gmail' : 'Outlook'} is not set up yet. Ask an admin to add the OAuth client under Integrations.`,
          needs_admin_setup: true,
        }, { status: 400 });
      }
      const redirectUri = (body.redirect_uri || '').trim();
      if (!verifyRedirectOrigin(req, redirectUri)) {
        return Response.json({ error: 'Redirect origin or path is not allowed.' }, { status: 400 });
      }
      const state = crypto.randomUUID();
      const codeVerifier = createPkceVerifier();
      // Persist short-lived OAuth state on the user profile settings blob via a connection stub
      await base44.asServiceRole.entities.EmailMailboxConnection.create({
        organisation_id: org.id,
        user_id: user.id,
        provider,
        email_address: '',
        status: 'error',
        encrypted_tokens: await encryptTokens({ oauth_state: state, redirect_uri: redirectUri, code_verifier: codeVerifier, pending: true }),
        scopes: scopesFor(provider),
        connected_at: new Date().toISOString(),
        last_error: 'oauth_pending',
      });
      const url = buildAuthorizeUrl({
        provider,
        clientId: oauth.clientId,
        redirectUri,
        state,
        codeChallenge: await pkceChallenge(codeVerifier),
      });
      return Response.json({ authorize_url: url, state });
    }

    if (action === 'complete_connect') {
      const provider = body.provider;
      const code = (body.code || '').trim();
      const state = (body.state || '').trim();
      const redirectUri = (body.redirect_uri || '').trim();
      if ((provider !== 'gmail' && provider !== 'outlook') || !code || !state || !redirectUri) {
        return Response.json({ error: 'provider, code, state, and redirect_uri are required' }, { status: 400 });
      }

      if (!verifyRedirectOrigin(req, redirectUri)) {
        return Response.json({ error: 'OAuth redirect is not allowed.' }, { status: 400 });
      }
      const pending = await base44.asServiceRole.entities.EmailMailboxConnection.filter(
        { organisation_id: org.id, user_id: user.id, provider },
        '-connected_at',
        20,
      ).catch(() => []);
      let match = null;
      let savedSession = null;
      for (const entry of pending || []) {
        if (entry.status !== 'error' || entry.last_error !== 'oauth_pending') continue;
        const issuedAt = Date.parse(entry.connected_at || '');
        if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + 60_000 ||
            Date.now() - issuedAt > PENDING_OAUTH_TTL_MS) continue;
        const candidate = await decryptTokens(entry.encrypted_tokens).catch(() => null);
        if (candidate?.pending && candidate.oauth_state === state &&
            candidate.redirect_uri === redirectUri && candidate.code_verifier) {
          match = entry; savedSession = candidate; break;
        }
      }
      if (!match || !savedSession) {
        return Response.json({ error: 'OAuth session is expired, used or invalid. Start again.' }, { status: 400 });
      }
      // A pending OAuth state becomes unusable before contacting the provider.
      await base44.asServiceRole.entities.EmailMailboxConnection.update(match.id, {
        last_error: 'oauth_exchanging', encrypted_tokens: await encryptTokens({
          oauth_state: state, redirect_uri: redirectUri, pending: false,
        }),
      });

      const oauth = await getOAuthClient(base44, org, provider);
      if (!oauth.configured) {
        return Response.json({ error: 'OAuth client is not configured.' }, { status: 400 });
      }

      const tokens = await exchangeCodeForTokens({
        provider,
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret,
        code,
        redirectUri,
        codeVerifier: savedSession.code_verifier,
      });
      const email = await fetchMailboxAddress(provider, tokens.access_token);
      const encrypted = await encryptTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
      });
      const expires = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString();

      // Drop other connections for this user+provider (including pending stubs)
      for (const c of pending || []) {
        if (c.id !== match.id) {
          await base44.asServiceRole.entities.EmailMailboxConnection.delete(c.id).catch(() => null);
        }
      }

      await base44.asServiceRole.entities.EmailMailboxConnection.update(match.id, {
        email_address: email,
        status: 'active',
        encrypted_tokens: encrypted,
        token_expires_at: expires,
        scopes: tokens.scope || '',
        connected_at: new Date().toISOString(),
        last_error: '',
      });

      return Response.json({ ok: true, provider, email_address: email });
    }

    if (action === 'disconnect') {
      const provider = body.provider;
      if (provider !== 'gmail' && provider !== 'outlook') {
        return Response.json({ error: 'provider must be gmail or outlook' }, { status: 400 });
      }
      const rows = await base44.asServiceRole.entities.EmailMailboxConnection.filter(
        { organisation_id: org.id, user_id: user.id, provider },
        '-connected_at',
        20,
      ).catch(() => []);
      for (const c of rows || []) {
        await base44.asServiceRole.entities.EmailMailboxConnection.delete(c.id).catch(() => null);
      }
      return Response.json({ ok: true });
    }

    if (action === 'create_draft') {
      // Save-draft: admins, BDMs, solo SDRs, or campaign-permissioned callers.
      const role = profile.app_role;
      let allowed = ['platform_owner', 'organisation_admin', 'sales_manager'].includes(role);
      if (!allowed && role === 'bdm') {
        const profiles = await base44.asServiceRole.entities.UserProfile.filter(
          { organisation_id: org.id, user_id: user.id }, '-created_date', 1,
        ).catch(() => []);
        const managedBy = profiles?.[0]?.managed_by_user_id || '';
        let campaignAllows = false;
        if (body.campaign_id) {
          const camp = await base44.asServiceRole.entities.Campaign.get(body.campaign_id).catch(() => null);
          campaignAllows = !!(camp && camp.organisation_id === org.id && camp.callers_may_save_email_drafts);
        }
        allowed = !managedBy || campaignAllows;
      }
      if (!allowed) {
        return Response.json({
          error: 'Saving mailbox drafts is limited to admins, BDMs, solo callers, or campaigns where admin has allowed caller email drafts. Your info request was sent to the admin inbox instead.',
          code: 'email_draft_not_permitted',
        }, { status: 403 });
      }

      const provider = body.provider;
      if (provider !== 'gmail' && provider !== 'outlook') {
        return Response.json({ error: 'provider must be gmail or outlook' }, { status: 400 });
      }
      const subject = (body.subject || '').trim();
      const draftBody = (body.body || '').trim();
      if (!subject || !draftBody) {
        return Response.json({ error: 'subject and body are required' }, { status: 400 });
      }

      const rows = await base44.asServiceRole.entities.EmailMailboxConnection.filter(
        { organisation_id: org.id, user_id: user.id, provider, status: 'active' },
        '-connected_at',
        1,
      ).catch(() => []);
      const connection = rows && rows[0];
      if (!connection) {
        return Response.json({
          error: `Connect your ${provider === 'gmail' ? 'Gmail' : 'Outlook'} account first.`,
          needs_connect: true,
        }, { status: 400 });
      }

      const { accessToken } = await getFreshAccessToken(base44, org, connection);
      const draft = provider === 'gmail'
        ? await createGmailDraft({
            accessToken,
            to: body.to || '',
            cc: body.cc || '',
            subject,
            body: draftBody,
          })
        : await createOutlookDraft({
            accessToken,
            to: body.to || '',
            cc: body.cc || '',
            subject,
            body: draftBody,
          });

      return Response.json({
        ok: true,
        provider,
        mailbox: connection.email_address,
        draft,
        message: 'Draft saved in your mailbox — open Gmail/Outlook to review and send.',
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || 'Email mailbox error' }, { status: e.status || 500 });
  }
}
