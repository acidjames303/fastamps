import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getFreshAccessToken } from '../../shared/emailMailbox.ts';

// Read-only, per-user mailbox preview. No mail is sent or imported into the CRM.
// Enforces ownership even though token retrieval uses the server service role.
const MAX_MESSAGES = 20;
const MAX_BODY = 30000;
const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const clean = (value: unknown, limit = 500) => String(value || '').slice(0, limit);
const decodeEntities = (value: string) => value
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");

function plainHtml(value: string) {
  return decodeEntities(value.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .slice(0, MAX_BODY);
}

function decodeBase64Url(raw: string) {
  if (!raw) return '';
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, MAX_BODY);
  } catch {
    return '';
  }
}
function gmailHeader(message: any, header: string) {
  return clean((message.payload?.headers || []).find((h: any) =>
    String(h.name || '').toLowerCase() === header.toLowerCase())?.value, 2000);
}
function gmailText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts || []) {
    const extracted = gmailText(part);
    if (extracted) return extracted;
  }
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return payload.mimeType === 'text/html' ? plainHtml(decoded) : decoded;
  }
  return '';
}
function senderAddress(from: string) {
  const match = from.match(/<([^<>]+@[^<>]+)>/) || from.match(/([^\s,<>]+@[^\s,<>]+)/);
  return clean(match?.[1] || '', 320);
}
function formatGmail(message: any, includeBody = false) {
  const from = gmailHeader(message, 'From');
  const subject = gmailHeader(message, 'Subject');
  return {
    id: clean(message.id, 300),
    thread_id: clean(message.threadId, 300),
    from: clean(from, 400),
    from_email: senderAddress(from),
    reply_to_email: senderAddress(gmailHeader(message, 'Reply-To')) || senderAddress(from),
    to: gmailHeader(message, 'To'),
    date: gmailHeader(message, 'Date'),
    subject: clean(subject, 700),
    snippet: clean(message.snippet, 500),
    unread: (message.labelIds || []).includes('UNREAD'),
    ...(includeBody ? { body_text: gmailText(message.payload) || clean(message.snippet, 2000) } : {}),
  };
}
function formatOutlook(message: any, includeBody = false) {
  const fromName = clean(message.from?.emailAddress?.name, 150);
  const email = clean(message.from?.emailAddress?.address, 320);
  const sender = fromName && email ? fromName + ' <' + email + '>' : email;
  return {
    id: clean(message.id, 300),
    thread_id: clean(message.conversationId, 300),
    from: sender,
    from_email: email,
    reply_to_email: clean(message.replyTo?.[0]?.emailAddress?.address || email, 320),
    to: (message.toRecipients || []).map((x: any) => x.emailAddress?.address).filter(Boolean).join(', ').slice(0, 1000),
    date: clean(message.receivedDateTime, 100),
    subject: clean(message.subject, 700),
    snippet: clean(message.bodyPreview, 500),
    unread: message.isRead === false,
    ...(includeBody ? { body_text: message.body?.contentType === 'html'
      ? plainHtml(message.body?.content || '')
      : clean(message.body?.content || message.bodyPreview, MAX_BODY) } : {}),
  };
}
async function fetchJson(url: string, accessToken: string, headers: Record<string,string> = {}) {
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json', ...headers },
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === 'object'
      ? data.error?.message
      : (data.error_description || data.error);
    const error: any = new Error(clean(message || 'Mailbox provider request failed', 350));
    error.status = response.status === 401 ? 401 : response.status === 403 ? 403 : 502;
    throw error;
  }
  return data;
}

export default async function (req: Request) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner','organisation_admin','sales_manager','internal_bd','bdm'].includes(profile.app_role)) {
      return Response.json({ error: 'Outreach inbox is limited to the private pilot.' }, { status: 403 });
    }
    const body: any = await req.json().catch(() => ({}));
    const provider = body.provider;
    if (!['gmail', 'outlook'].includes(provider)) {
      return Response.json({ error: 'Choose Gmail or Outlook.' }, { status: 400 });
    }
    const action = body.action || 'list';
    if (!['list', 'get'].includes(action)) {
      return Response.json({ error: 'Unsupported read-only inbox action.' }, { status: 400 });
    }
    const connections = await base44.asServiceRole.entities.EmailMailboxConnection.filter(
      { organisation_id: org.id, user_id: user.id, provider, status: 'active' },
      '-connected_at', 1,
    );
    const connection = connections?.[0];
    if (!connection) {
      return Response.json({ ok: false, needs_connect: true,
        error: 'Connect your personal mailbox before reading messages.' });
    }
    const grantedScopes = String(connection.scopes || '').split(/[\s,]+/);
    const hasReadAccess = provider === 'gmail'
      ? grantedScopes.includes(GMAIL_READ_SCOPE)
      : grantedScopes.some((scope: string) => scope.endsWith('/Mail.ReadWrite') || scope === 'Mail.ReadWrite' || scope === 'Mail.Read');
    if (!hasReadAccess) {
      return Response.json({
        ok: false, needs_reconnect: true,
        error: 'Your current mailbox permission only allows drafts. Reconnect and approve read-only inbox access.',
      });
    }
    const { accessToken } = await getFreshAccessToken(base44, org, connection);
    if (action === 'list') {
      if (provider === 'gmail') {
        const pageToken = clean(body.cursor, 500);
        if (pageToken && !/^[A-Za-z0-9_\-=]+$/.test(pageToken)) {
          return Response.json({ error: 'Invalid inbox page token.' }, { status: 400 });
        }
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        url.searchParams.set('labelIds', 'INBOX');
        url.searchParams.set('maxResults', String(MAX_MESSAGES));
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const list = await fetchJson(url.toString(), accessToken);
        const ids = (list.messages || []).slice(0, MAX_MESSAGES);
        // Bound concurrent provider requests to avoid bursts and rate-limit errors.
        const messages: any[] = [];
        for (let i = 0; i < ids.length; i += 5) {
          const batch = await Promise.all(ids.slice(i, i + 5).map((m: any) => {
            const u = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(m.id));
            u.searchParams.set('format', 'metadata');
            for (const name of ['From', 'To', 'Reply-To', 'Subject', 'Date']) u.searchParams.append('metadataHeaders', name);
            return fetchJson(u.toString(), accessToken).then((v: any) => formatGmail(v));
          }));
          messages.push(...batch);
        }
        return Response.json({ ok: true, provider, mailbox: connection.email_address,
          messages, next_cursor: clean(list.nextPageToken, 500), read_only: true });
      }
      const offset = Number(body.cursor || 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000) {
        return Response.json({ error: 'Invalid inbox page number.' }, { status: 400 });
      }
      const url = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages');
      url.searchParams.set('$top', String(MAX_MESSAGES));
      url.searchParams.set('$skip', String(offset));
      url.searchParams.set('$orderby', 'receivedDateTime desc');
      url.searchParams.set('$select', 'id,conversationId,subject,from,replyTo,toRecipients,receivedDateTime,bodyPreview,isRead');
      const data = await fetchJson(url.toString(), accessToken);
      const messages = (data.value || []).map((m: any) => formatOutlook(m));
      return Response.json({ ok: true, provider, mailbox: connection.email_address,
        messages, next_cursor: data['@odata.nextLink'] && messages.length === MAX_MESSAGES
          ? String(offset + MAX_MESSAGES) : '', read_only: true });
    }

    const messageId = clean(body.message_id, 300);
    if (!messageId || !/^[A-Za-z0-9_+=\/-]{1,300}$/.test(messageId)) {
      return Response.json({ error: 'Invalid message identifier.' }, { status: 400 });
    }
    if (provider === 'gmail') {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(messageId));
      url.searchParams.set('format', 'full');
      const data = await fetchJson(url.toString(), accessToken);
      return Response.json({ ok: true, provider, message: formatGmail(data, true), read_only: true });
    }
    const url = new URL('https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent(messageId));
    url.searchParams.set('$select', 'id,conversationId,subject,from,replyTo,toRecipients,receivedDateTime,bodyPreview,isRead,body');
    const data = await fetchJson(url.toString(), accessToken, { Prefer: 'outlook.body-content-type="text"' });
    return Response.json({ ok: true, provider, message: formatOutlook(data, true), read_only: true });
  } catch (error: any) {
    return Response.json({ error: clean(error?.message || 'Unable to read mailbox', 400) },
      { status: error?.status || 500 });
  }
}
