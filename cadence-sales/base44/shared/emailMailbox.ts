// Per-user Gmail / Outlook mailbox layer for saved drafts and consented read-only inbox preview.
//
// Security contract:
//  - OAuth client id/secret are organisation-scoped and stored in the encrypted
//    ProviderCredential store (providerCredentials.ts) — never in the browser.
//  - Access/refresh tokens are AES-GCM encrypted with CREDENTIAL_ENCRYPTION_KEY
//    before they are written to EmailMailboxConnection, and are never returned.
//  - OAuth `state` is a random value persisted with the pending connection and
//    matched on callback, so a code cannot be replayed or injected.
//  - Nothing here sends mail. Drafts and consented inbox reading only.
import { getOrgCredentials, encryptJSON, decryptJSON } from './providerCredentials.ts';

const PROVIDERS = {
  gmail: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email openid',
    clientIdField: 'GMAIL_OAUTH_CLIENT_ID',
    clientSecretField: 'GMAIL_OAUTH_CLIENT_SECRET',
  },
  outlook: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: 'offline_access openid email https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read',
    clientIdField: 'OUTLOOK_OAUTH_CLIENT_ID',
    clientSecretField: 'OUTLOOK_OAUTH_CLIENT_SECRET',
  },
};

function providerConfig(provider: string) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error('provider must be gmail or outlook');
  return cfg;
}

export function scopesFor(provider: string): string {
  return providerConfig(provider).scopes;
}

export async function getOAuthClient(base44, org, provider: string) {
  const cfg = providerConfig(provider);
  const creds = await getOrgCredentials(base44, org);
  const clientId = (creds.get(cfg.clientIdField) || '').trim();
  const clientSecret = (creds.get(cfg.clientSecretField) || '').trim();
  return { configured: !!(clientId && clientSecret), clientId, clientSecret };
}

export function createPkceVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}
function base64Url(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}
export function buildAuthorizeUrl({ provider, clientId, redirectUri, state, codeChallenge }) {
  const cfg = providerConfig(provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${cfg.authorize}?${params.toString()}`;
}

export async function encryptTokens(tokens) {
  return encryptJSON(tokens);
}

export async function decryptTokens(encrypted) {
  if (!encrypted) return {};
  return decryptJSON(encrypted);
}

export async function exchangeCodeForTokens({ provider, clientId, clientSecret, code, redirectUri, codeVerifier }) {
  const cfg = providerConfig(provider);
  const res = await fetch(cfg.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed');
  return data;
}

async function refreshTokens({ provider, clientId, clientSecret, refreshToken }) {
  const cfg = providerConfig(provider);
  const res = await fetch(cfg.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed');
  return data;
}

export async function fetchMailboxAddress(provider: string, accessToken: string) {
  if (provider === 'gmail') {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Could not read Gmail address');
    return data.email || '';
  }
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Could not read Outlook address');
  return data.mail || data.userPrincipalName || '';
}

// Returns a usable access token, refreshing and re-encrypting it when expired.
export async function getFreshAccessToken(base44, org, connection) {
  const tokens = await decryptTokens(connection.encrypted_tokens);
  const expiresAt = connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0;
  const stillValid = tokens.access_token && expiresAt > Date.now() + 60_000;
  if (stillValid) return { accessToken: tokens.access_token };

  if (!tokens.refresh_token) throw new Error('Mailbox connection expired. Reconnect your mailbox.');

  const oauth = await getOAuthClient(base44, org, connection.provider);
  if (!oauth.configured) throw new Error('OAuth client is not configured for this provider.');

  const fresh = await refreshTokens({
    provider: connection.provider,
    clientId: oauth.clientId,
    clientSecret: oauth.clientSecret,
    refreshToken: tokens.refresh_token,
  });

  const merged = {
    ...tokens,
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || tokens.refresh_token,
  };
  await base44.asServiceRole.entities.EmailMailboxConnection.update(connection.id, {
    encrypted_tokens: await encryptJSON(merged),
    token_expires_at: new Date(Date.now() + (Number(fresh.expires_in) || 3600) * 1000).toISOString(),
  });
  return { accessToken: merged.access_token };
}

function encodeHeader(value: string) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function toBase64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Creates a Gmail draft from a plain-text body. Never sends.
export async function createGmailDraft({ accessToken, to, cc, subject, body }) {
  const headers = [
    `To: ${encodeHeader(to)}`,
    cc ? `Cc: ${encodeHeader(cc)}` : '',
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ].filter(Boolean);
  // RFC 5322 requires a blank line between headers and message body.
  const raw = toBase64Url([...headers, '', body].join('\r\n'));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Gmail draft could not be saved');
  return { id: data.id || '', web_link: 'https://mail.google.com/mail/u/0/#drafts' };
}

// Creates an Outlook draft. Never sends.
export async function createOutlookDraft({ accessToken, to, cc, subject, body }) {
  const split = (value: string) =>
    String(value || '')
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map((address) => ({ emailAddress: { address } }));

  const payload: Record<string, unknown> = {
    subject: encodeHeader(subject),
    body: { contentType: 'Text', content: body },
    toRecipients: split(to),
  };
  if (cc) payload.ccRecipients = split(cc);

  const res = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Outlook draft could not be saved');
  return { id: data.id || '', web_link: 'https://outlook.office.com/mail/drafts' };
}