# Cadence Outreach — Verified Development Log

## 2026-11-23 · Initial audit and setup

**State:** first draft-studio implementation is in the isolated branch only. No functioning synced inbox, sending queue, or AI email automation has yet been delivered. Branch: `feature/cadence-outreach` (6b0457352b4c13e5f517e78d). Live main unchanged.

### Verified source of truth
- Cadence's existing app is an active Vite/React application with legacy CRM, call, campaign and beta workflows.
- Existing schemas: `EmailMailboxConnection`, `Contact`, `Company`, `Prospect`, `ProspectList`, `AccountResearch`, `CompanyIntelligence`, `Campaign`, `SuppressionEntry`, `Task`, `FeatureFlag`.
- Current `base44/functions/manageEmailMailbox/entry.ts` supports OAuth status/connect/disconnect and `create_draft`, **not** inbox reading/sync or live sending. Existing `src/components/dialer/EmailDraftModal.jsx` saves a draft into Gmail/Outlook only.
- Gmail and Outlook connectors are listed as available, **not connected** to this app as checked 2026-11-23. OAuth provider-specific checks remain outstanding.
- Existing navigation contains `/manager-inbox`, meaning caller information requests, **not** the new personal Outreach Inbox. Avoid conflating.
- Existing scheduled automation Cadence Aileen Readiness works on original beta; preserve the workflow.
- Master product and agent prompt in `docs/CADENCE_OUTREACH_MASTER_BUILD_PROMPT.md`.

### Confirmed setup
- Isolated feature branch created.
- Dedicated weekday autonomous Outreach Builder scheduled.
- Independent read-only Outreach QA Subagent scheduled.
- Independent read-only Outreach Research & Sales Copy Subagent scheduled twice weekly.

### Branch M1 implementation now present (not yet acceptance-tested)
- New platform-owner gated `/outreach` page linked on desktop and mobile, with FastAmps / B2B Sales Leads / Acid James brand selection.
- Draft list, editable subject/To/CC/BCC/body, save, reopen, delete, copy to clipboard, clear unsaved-change warning and explicit draft-only mode.
- Personal signature records: create, edit, delete, default per brand, select and append on copy/mailbox-draft export.
- Directly reuses the existing Gmail/Outlook OAuth connect and create_draft functionality; no actual send code or new mail permission added.
- Added `OutreachDraft` and `OutreachSignature` schemas with organisation AND individual-owner RLS; their live API persistence and isolation remain to be tested in a signed-in branch session.
- Existing mailbox-draft connection has no BCC support; the UI explicitly blocks export rather than silently dropping BCC.
- `npm run build` passed twice on the branch (2026-11-23). Targeted eslint returned 0 errors and one App.jsx configuration-ignored warning. UI clickthrough, provider OAuth journey and backend entity persistence NOT YET verified.

### Not implemented / not verified
- Two-way inbox sync, MBOX/EML import, historical reconciliation, rich-text HTML editor/attachments, AI response suggestions, personalised bulk draft generation and review queue, sending scheduler, reply monitoring and follow-up engine.
- No connected personal inboxes. No outbound emails have been sent.
- No changes have been merged to main or deployed.

### Highest-priority next change
M1 QA: Verify the newly written draft and signature entity persistence in a signed-in branch preview, and test create/edit/delete/reload/default signature and cross-tenant access denial. Check actual mobile navigation, source-generated preview and error states. Fix any issues. M2 next: expand from draft-only connector to consented inbox synchronization. Never turn on sending before reviewed queue and safeguards are implemented.

### Release gate
Never merge or deploy until actual interactive journeys work, regression and tenant isolation pass and the feature can ship with sending disabled. Record evidence, not just claims.

## 2026-11-23 · M2 consented read-only inbox (checkpoint 6b0462976dca89edd08e3964)

**Status:** source implementation and static build verification complete on isolated branch. Real provider OAuth and browser tests outstanding. Main still unchanged.

- New server function \`base44/functions/readOutreachInbox/entry.ts\` lists recent Gmail/Outlook inbox messages and reads selected message bodies. It checks the authenticated tenant/user and owned mailbox connection before calling provider APIs. It has **no send/mutate actions**.
- Gmail requested scope expanded to \`gmail.readonly\` alongside \`gmail.compose\`. The backend refuses read access on existing draft-only connections until the user reauthorises. Outlook requires the existing delegated Mail.ReadWrite grant.
- New \`src/components/email/OutreachInbox.jsx\`: account switcher, read-only inbox preview, message detail, pagination, refresh, reconnect guidance and **Write editable reply draft**, reusing the current draft/signature editor. No threading or sending claims.
- Existing \`src/components/email/EmailMailboxConnect.jsx\` now offers a clear **Reauthorise** control.
- Corrected malformed Gmail MIME draft encoding: restored required header/body blank line.
- Tests: \`npm run build\` exit 0; targeted React eslint exit 0; backend TypeScript esbuild parse passed.
- Important limits: no confirmed live provider connection, no sync into CRM, no mailbox-mutation controls, no AI-generated replies, no approved send queue. Browser/tenant/permissions checks are NOT yet signed off.
- Detailed implementation and testing evidence: \`docs/outreach/implementation-log.md\`.

**Next:** independent QA of personal mailbox security and connected-provider real-world test; then provider-threaded replies and historical contact reconciliation. Production deployment and live sending remain blocked by release gates.
## 2026-11-24 — Mailbox security hardening (private branch)

- Hardened EmailMailboxConnection CRUD RLS to deny direct client access to token-bearing records; provider functions use authenticated service-role reads and per-user/organisation filters.
- Added OAuth S256 PKCE verifier/challenge, encrypted verifier inside temporary connection stub, fail-closed origin/path validation, 10-minute state lifetime, callback redirect equality and pending-state invalidation before token exchange.
- Do not infer granted OAuth scopes from requested permissions; record returned token scopes only.
- Enforced platform-owner pilot restriction in readOutreachInbox backend.
- Fixed Outlook/Gmail account-switch race using epoch-based invalidation of in-flight requests before rendering or replying.
- Verified `npm run build`, targeted eslint, backend esbuild parsing with platform virtual imports external, mailbox RLS static test, and read-only function no-send scan: PASS.
- Not yet verified: live OAuth re-consent with provider, runtime tenant isolation, API browser journeys, external auth application setup. Do not merge/publish until those tests pass.
## 2026-11-24 — M3 Campaign Studio and human review (branch only)

**Changes implemented in this build pass:**
- Server-owned `OutreachLead` records with per-owner and per-organisation RLS, source file/name, verification/review statuses, brands and import-batch identifiers.
- `manageOutreachLeads` function for 40-row resumable CSV/XLSX import batches, duplicate detection within and across batches, named-address checks, source provenance, organisation-wide hashed email suppression checks, explicit manual contact review and approved-template merge-field draft generation in groups of 25. Every new imported address remains **unverified** and must be reviewed by its owner.
- New Campaign Studio screen with spreadsheet preview, up to 10,000 rows per file, contact review, manual exclusions, source labels, paging, strict user-editable subject/body templates, sample previews and draft generation. No enrichment provider calls and no outbound sends.
- Dedicated `reviewOutreachDrafts` backend: explicit user-directed review of up to 50 drafts per batch; SHA-256 fingerprint includes sender owner, brand, provider, recipients, message text, quoted text, signature ID **and signature content**; checks suppression and signature ownership; writes audit event. `approved_hold` is an informational state and **cannot trigger delivery**.
- Draft UI now has bulk selection, content approval/return, paginated draft list and clear no-send messaging. Editing any approved draft resets approval metadata.
- Reply drafting respects Gmail/Outlook Reply-To, retains editable quoted original below selected signature, and does not pretend to create threaded provider replies.
- Opt-in AI writing suggestions via existing cost-controlled `runSmartAction` (draft reply / shorten / humanise), with per-click consent to share draft/quote content with the AI service and clear use of Smart Action credits. Suggestions remain previews until manually applied; stale cross-brand results are discarded.
- Explicit confirmation shows connected mailbox identity and brand before exporting a personal email into provider Drafts. No sending endpoint was introduced.

**Verified offline tests**:
- 12 tests passed: private role, 3,000 synthetic imported contacts in 40-row chunks, repeat-batch deduplication, suppression, manual review, draft merging/idempotency, foreign-user denial, OAuth origin/path validation, expired/mismatched state refusal and replay protection, fingerprint/signature change, approval cancellation.
- `npm run build` and targeted React ESLint: passed. Four backend entrypoints parse/bundle with Base44 virtual modules marked external. Static RLS/no-send source checks: passed.
- Main stayed at revision `bf39dbcf159a8a6e0ed02f0db090a6b23703aaee`; branch development did not merge to or deploy production.

**Unverified and blocked**:
- No actual signed-in branch browser CRUD/permission checks, provider authorisation, Google/Microsoft OAuth consent or production mailbox synchronisation. Synthetic tests do not establish live platform security.
- No true multi-provider historical thread sync, provider-native reply threading, rich-text attachments, EML/MBOX import, research-assisted AI claims with source linking, continuous lead discovery, transactional scheduling/send queue, reply/bounce/opt-out watcher or automatic follow-up sequence.
- No live emails sent, no private mailbox connected, no product/source research provider credits used during code testing.
- Dedicated future sender-account mapping and brand-level permissions must be verified before an actual sending system is enabled.
- Continue isolated branch development and independent QA. Do **not** merge or publish until actual browser and mailbox integration tests, security/regression gates and Aileen production preservation are independently verified.

**Next highest-impact safe milestone:** signed-in branch acceptance test for all new entity writes, company/contact imports and provider OAuth, followed by private real mailbox test and historical reconciliation. Only then design and test an approved/hashed per-user send queue and reply-aware follow-ups.

## 2026-11-24 — M4 Personal workspaces, templates, Mac Mail export, held scheduling

**Built in isolated `feature/cadence-outreach` branch only; live main unchanged.**

1. Outreach route and backend access expanded from platform-owner pilot to active authorised sales membership roles: platform owner, organisation admin, sales manager, internal BDM, and BDM. Reporting-only members still excluded. Per-user ownership remains mandatory.
2. New `OutreachWorkspace` schema and Workspaces panel. JP and Malcolm can independently select FastAmps, B2B Sales Leads, Acid James, Other, or create personal custom workspaces, each with its own key, name, writing guidance and optional sender identity *label*. Custom keys are verified server-side against the authenticated owner before lead import/generation; archived workspace records remain preserved.
3. New `OutreachTemplate` schema and visible Templates editor. Per-workspace, per-user save/edit/delete/apply. Upload plain text, Markdown and EML source files into editable text. Campaign Studio now includes a saved template selector.
4. New `exportOutreachDrafts` backend with owner- and organisation-scoped pagination (100/page), personal signatures and draft metadata. New Download for Mac Mail view can download a CSV or portable MBOX archive of 3,000+ drafts. MBOX is a message archive; Apple Mail imports into imported mailboxes and **does not** automatically turn imported messages into sendable drafts.
5. New client-side AppleScript exporter generates batches of up to 50 **unsent draft creation commands** for macOS Mail, with script confirmation and no send commands. A 1-draft or 10-draft test pack replaces all prospect recipients with an individually provided own test email and marks subjects [TEST]. Running this local script (not Cadence) creates draft messages; the user must manually inspect and send them to receive a real test message. Mac Mail script runtime behavior on the user's Mac has NOT been verified.
6. New `manageOutreachSchedule` backend and Schedule & Hold screen allow reviewed drafts to receive user-planned dates, weekdays/working-hour/maximum-per-day constraints and explicit approval content fingerprint checks. All dates are `scheduled_hold` and **delivery_enabled=false**; there is no worker, provider send API or automatic test/send mechanism. Batch operations up to 50 records per call, suitable for 3,000 drafts. Supports cancellation/reverting to held.
7. Added guidance: Apple Mail is a local client. Direct hosted account sync requires the account's underlying Google/Microsoft provider or, later, a secured IMAP/SMTP adapter. Never ask for Apple Mail application passwords within Cadence before secure integration exists.

**Quality evidence:** 24 offline tests passed (12 existing plus 12 new) including 3,000-draft CSV export, 3,000-draft per-owner pagination, cross-user custom workspace denial, Mac test redirection, script escaping/no-send, UK winter/summer DST, 3,000 planned schedule dates at 40/day, suppression, fingerprint mismatch and held schedule access controls. Vite build, targeted ESLint, six backend function parses and entity RLS source checks passed. The complete browser QA, app-provider OAuth and authenticated permissions are still NOT verified.

**Release blockers, highest priority:**
- Run signed-in, user-isolated browser tests under JP and a Malcolm-like test account for template, workspace, import, export, schedule and role navigation.
- Validate AppleScript draft creation on a real Mac with one harmless test draft, including account selection, signatures and OS permissions, before bulk packs.
- Complete secure, consented Google/Microsoft provider OAuth account connection tests and decide whether a generic IMAP/SMTP provider bridge is needed for actual FastAmps Mac Mail hosting.
- Implement actual outbound testing to a sender-owned verified address, then idempotent approved send delivery, scheduling workers, bounce/reply/optout stopping, sending limits, source provenance and account signatures with separate independent QA. Never activate sending without these gates.
- The production UI has NOT been merged or deployed. User-visible release remains conditional on complete independent QA.

**Next autonomous builder task:** authenticated multi-user browser QA and provider hosting investigation, not additional feature expansion until verified.

## 2026-11-24 — M5 UI/UX review and safe workflow polish (isolated branch)

**Method:** reviewed current React UI structure, route/brand navigation and app preview metadata. Authenticated desktop/mobile visual click-through was not available in this session; do not represent source-based findings as screenshot-tested.

**Problems discovered and corrected:**
- The page opened on a non-connected Inbox, making it unclear how to start a campaign without provider OAuth. Added an **Overview** landing screen with prominent Create campaign / Write one email actions, role-specific next steps, Mail connection guidance, a link to templates and visible reminder that automatic sending is disabled.
- The Drafts pagination originally fetched 100 across *all* brands and then filtered locally; this could falsely show an empty workspace. Drafts are now requested with the **current workspace key** in the entity filter. Switching or creating workspaces resets the draft page and selected IDs.
- The previous grouped navigation had no obvious homepage and could overwhelm the compact header. Added Overview tab, responsive separation of navigation from the workspace picker on narrow screens, escape-key close on More/workspace menus, and accessible current-page indicators/focus styling.
- Campaign draft studio now presents an explicit Import → Review & draft progression, with disabled step navigation during long imports, on-page review status filters, page-local contact search, accurate checked-state when there are zero approved contacts, and clearer step-three draft creation labels. Search/filters explicitly state they apply to the current page, not the entire campaign.
- Corrected misleading Schedule menu wording: planning dates are HELD and no emails are automatically sent.

**Verification:** `npm run build` passed; targeted ESLint passed; all **24 pre-existing Outreach automated tests passed**. No backend sending, OAuth, customer mailbox, tenant membership or production logic was touched by this UI milestone. Production main remains unmerged/unpublished.

**Next UX opportunities before production:**
1. True signed-in desktop/tablet/mobile click-through with JP and independent Malcolm-like user, including browser-width screenshots and accessibility keyboard/focus checks.
2. For 3,000+ drafts, implement **server-side** recipient/subject/status search, accurate total counts, campaign-level grouping, bulk selection across pages with explicit review limits, and a visible resumable import/review activity summary. Do not pretend page-local filters are global.
3. Give the editor full email identity preview (From, To/CC/BCC, signature, quoted text and eventual HTML rendering) next to the draft, with autosave and unsaved-change safeguards.
4. Step-by-step Mac Mail bridge walkthrough with verified macOS test account, and clear distinction between script-created unsent drafts, MBOX imports and actual delivered test sends.
5. Release gate remains provider OAuth, personal mailbox security tests, user ownership/role isolation in live runtime, responsive QA, and approved held-message logic before any delivery system is considered.

## 2026-11-24 — M6 company identity + source-governed personalisation (isolated branch)

### Inspected
- Existing OutreachLead importer previously deduplicated by exact address and merged `{{first_name}}` and `{{company_name}}` without confirmed company identities or research provenance.
- Existing Cadence `CompanyIntelligence` cache keys results to domain or normalised name, and research jobs use web-grounded LLMs. While useful for shared research efficiency, that historical AI cache is **not considered verified evidence for personal Outreach emails**.
- Official Companies House company search and company profile/registration-number resources were consulted as the correct UK legal-entity verification method. Registration details do not independently prove operations/projects, and group/trading entities may differ.
- No actual user-supplied company CSV/XLSX was provided for this run; Oakwood/Thornhill/Forge examples in tests are entirely **synthetic**, not real research claims.

### Built
- Central `base44/shared/outreachIdentity.ts` with conservative company-name normalisation; domain and company-number clues; similarity/conflict flags; explicit first/last name extraction and unverified `first.last@` suggestions, which NEVER become recipient identity without human confirmation; strict merge renderer.
- Enhanced `OutreachLead` persistence with independent company/name provenance, source URLs, reviewed research fact, manual review timestamp and `flagged_company` status. Original source contact/company strings retained.
- Updated 40-at-a-time importer to flag suspected similar/different business entities across previous imports and within the same batch. Flags show matched candidate name/domain/reason. Genuine same-name-plus-domain colleagues do not automatically quarantine every contact.
- `OutreachCampaignStudio` exposes **Company flags** folder, per-lead Compare/Review, source-file attribution, original person-name hint, and a real-contact email preview with `{{greeting}}` default. `{{greeting}}` becomes `Hi James` only with a supplied/confirmed first name, otherwise `Hello`. Missing explicit `{{first_name}}` or `{{verified_company_fact}}` returns an error, not invented text.
- `OutreachCompanyReview` allows owner to inspect similar names, open Companies House search and exact evidence link, record the true company name, website/company number, review note and an optional separately sourced research fact, and individually confirm the real person's name. Company release always returns to needs_review until a separate contact approval.
- `suggestOutreachCompanyResearch` optional per-company web-grounded research suggestion from existing Cadence AI provider. Uses user click/consent plus existing provider permissions and company-research allowance; returns only URL-bearing tentative findings, zero promotional facts when identity is ambiguous. No automatic fact approval, no outbound email or contact write; actual live provider not tested or billed.
- Whenever a newly imported identity conflict affects an older lead, linked drafts revert to editable draft, content approval and schedule dates cleared, `identity_warning` set. Export data retains audit warning; Apple Mail script generation excludes/blocks flagged drafts; manual Copy and Gmail/Outlook Draft export are disabled for flagged draft view.
- Contact review, draft generation, content approval, held schedule planning and per-page Mac Mail export now re-check current flagged-company identity, including previously approved leads. Incomplete 500-result flag searches fail closed.

### Tests / evidence
- `npm run build` PASS; focused React ESLint PASS; five backend entrypoints compiled with esbuild PASS; personal lead/draft RLS owner+organisation static checks PASS; no send endpoint in newly changed functions.
- **43/43 offline synthetic automated tests pass**, including 3,000-contact import, duplicate collisions and cross-import quarantine, changing-company approval/schedule invalidation, first.last suggestion versus verified greeting, manually source-backed research fact, 3,000 draft export/schedule, opt-in AI permissions/no auto-write, OAuth and cross-user isolation.
- No network call to real research API, no real per-company verification, no customer mailbox authorisation, no messages sent and no change to production main.

### Remaining concerns / next actions
1. Signed-in Base44 runtime QA of Company flags folder and per-user isolation; validate actual data entity persistence, query filtering, browser responsiveness and long import/schedule.
2. Test optional research suggestions with provider consent/credit, verify HTTPS URLs genuinely refer to the correct company, review source dates/recency, and protect against malicious web-page instructions.
3. For 3,000+ names, the first-token name/500-hit candidate lookup is intentionally conservative and not exhaustive; add indexed company identity records, alias handling, backfill for older imports, explicit per-company flag group/review queue and global search.
4. Add an authoritative sourced company resolution flow using Companies House number and official-site match, keeping human approval; investigate corporate family/subsidiary mapping with separate legal entities. Never auto-merge by similar name.
5. Confirm source-lead identity before draft export through every client path, and perform signed-in validation that all owners' confirmed records remain private. No production merge or live scheduling/sending until security/acceptance gates pass.

**Release decision:** Development milestone complete and checkpoint eligible, production not ready. Existing calling, opportunities, contacts, campaigns, Aileen Readiness and main beta remain untouched.
