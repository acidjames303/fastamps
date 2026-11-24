# Cadence Outreach — implementation and verification log

## 2026-11-23 — M2 read-only mailbox preview

**Branch:** `feature/cadence-outreach` (isolated from production).

### Implemented

- New read-only `readOutreachInbox` backend function. It calls Google Gmail or Microsoft Graph using the *authenticated user's own* OAuth connection and checks that the record belongs to the certified user's organisation and user ID.
- Gmail first-page inbox metadata, bounded 20-message pagination, 5-at-a-time metadata fetch, full individual-message reading and UTF-8/plain-text extraction with text-only HTML fallback.
- Outlook inbox metadata and individual-message text reading with bounded paging. No remote URL from a client is fetched.
- Provider read scopes enforced server side. Existing Gmail compose-only connections must explicitly reauthorise `gmail.readonly`. Outlook uses already-requested `Mail.ReadWrite` delegated permission.
- A responsive Inbox view within Outreach, with mailbox selector, message list, detail view, refresh, load-more and connection/reconnection guidance.
- 'Write editable reply draft' from a received message; the message is copied into a personal Cadence draft for editing and signature selection. The preview clearly says it does not thread or send.
- Updated mailbox connection UI to support explicit reauthorisation.
- Corrected Gmail MIME draft creation: a blank line now separates RFC 5322 headers and body.
- Preserved previous personal draft and signature records, existing OAuth draft-only functions, and platform-owner-only Outreach route.

### Tests completed

- `npm run build`: **PASS** (Vite build exit code 0).
- `eslint` on modified React modules: **PASS** (exit code 0).
- `esbuild` TypeScript parse on the new backend function: **PASS**.
- Manual source review confirmed no send endpoint or mail mutation is called by the new function.

### Tests NOT yet completed

- No real Gmail or Outlook mailbox connected for testing in this build session.
- No verified end-to-end OAuth re-consent, message retrieval, or reply export in the browser.
- No backend provider mocks, cross-tenant runtime probes or real attachment test.
- Inbox view is read-only and transient; email history is **not yet imported** or reconciled with the CRM.
- A draft prepared from an inbox message is not a provider-native threaded reply.

### Release restrictions

- Do not merge/deploy the new inbox to the live beta until a real provider OAuth test, security tests, error handling, accessibility checks, and existing Cadence regression pass.
- Do not enable any sending or automatic follow-ups.
- Obtain user's consent before connecting any personal mailbox; provider application registration is an administrator task.
- Do not claim multi-inbox sync, AI replies or campaign sending exists yet.

### Next high-impact milestone

1. Verify Gmail/Outlook OAuth scopes and live inbox journeys with test accounts.
2. Create provider-threaded drafts linked to original messages, without sending.
3. Import approved historic conversations into the account's contact timeline with deduplication, privacy and per-tenant security controls.
4. Add safe templates, source-backed AI reply suggestions and the human approval queue.
