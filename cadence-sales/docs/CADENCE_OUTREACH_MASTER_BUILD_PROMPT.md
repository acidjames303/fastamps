# CADENCE OUTREACH — MASTER AUTONOMOUS BUILD PROMPT
Version: 1.0 · Owner: Cadence / FastAmps · Created: 2026-11-23
Branch: feature/cadence-outreach · App: 6a7338f6106b1962aa31c00a

## Mission
Act as the principal product engineer and coordinator of specialist AI agents responsible for building **Cadence Outreach**, a professional, intuitive, secure, human-controlled email and prospecting centre inside the existing Cadence CRM. The finished product should feel as simple to use as a modern email client, not like a complicated bulk-email marketing suite.

The user has authorised iterative development and publishing after evidence-based QA gates. You have *not* been authorised to connect their personal mailboxes on their behalf, read non-consented inboxes, send live promotional messages without their explicit per-message or per-batch approval, or disrupt Cadence's existing caller workflows and the Aileen beta.

**Real-world user outcomes:** (a) FastAmps housebuilder sales executive can work from historical emails, remember every contact, discover qualified new named contacts, send short personal intros and follow up without spreadsheets; (b) Malcolm can upload 3,000 named B2B contacts and review tailored campaign messages in batches before authorising staggered sending; (c) Acid James can separately research bookers/promoters and manage booking emails without exposing or mixing business customer data.

## Product UX: inbox first
A clear new top-level **Outreach** section with an attractive three-pane responsive layout:
- Left: brand/workspace selector; connected mailbox selector; Inbox, Unread, Sent, Drafts, Scheduled, Follow-ups, Campaigns, Contacts, Import, Settings. Show meaningful counts and filters; protect privacy.
- Centre: thread list with sender, subject, preview, date, status, unread and campaign tag; robust search; sort; keyboard shortcuts and bulk triage where appropriate.
- Right or fullscreen: conversation timeline including quoted reply context, recipients, attachments, contacts, company, previous calls, notes, research evidence, open opportunity and follow-up tasks. Work well on mobile.
- A highly accessible **Compose / Reply / Reply all / Forward** editor with editable To/CC/BCC, subject, rich-enough formatting (headings, bullets, links, bold), plain text mode, paste compatibility, attachments, autosave, manual save, undo, signature selector, template selector, preview, clear validation, send-later, save as mailbox draft, and AI improvements. Properly show HTML/plain-text and signatures safely. Never silently rewrite a user's edits.
- AI buttons: Draft reply, Make shorter, Sound more human, Tailor to company, Question first, Fix grammar, Rewrite within template, Explain research, Suggest next action. They produce suggestions, never replace approved text without acceptance.
- Unconfigured mailbox: display provider choices and connection wizard, not fabricated inbox data or unusable buttons. Explain Apple Mail must connect to the underlying hosting provider (Google Workspace, Microsoft 365, or other supported IMAP provider where feasible).
- Keep navigation visually consistent with Cadence's present styling; avoid bloating existing menus. Separate "Admin inbox" (caller information-request workflow) from Outreach personal Inbox.
- Avoid false metrics, simulated sends, dead buttons, unimplemented filter options, and invented real contacts.

## Functional capabilities
### A. Mailbox connections and historical sync
Per-user OAuth for Google Workspace/Gmail and Microsoft 365/Outlook, and secure extensible adapter for other providers. Reuse the existing `EmailMailboxConnection` and `manageEmailMailbox` draft-only functions; evaluate scope upgrade carefully, preserving existing OAuth clients. Use least-privilege permissions, provider API and renewal where available; never collect mailbox passwords or raw client secrets in frontend. A user's OAuth grant must never imply consent for a different mailbox/user.

Sync selected folders and past messages with incremental cursor/history APIs and bounded backfill. Support direct EML and MBOX imports where implementable and subject to source attribution, size limits, attachment scanning and dedup. CSV/Excel imports are for contacts; provide field mapper. Sync message IDs, RFC Message-ID/In-Reply-To/References, labels, read state, attachments metadata, sent receipts, bounce and reply classification. Preserve original raw content securely with retention and deletion tools. Do not access personal mailbox until the account owner consents and scopes are verified. Show initial sync status/progress and how much was read. Keep provider Sent and Drafts in sync, including actions taken outside Cadence (Mac Mail/Outlook).

### B. Contact/organisation knowledge
Map email conversations to company (canonical domain), contact, campaign, opportunity and all relevant Cadence call/task history. Distinguish historical business interactions from new outreach. Preserve customer-confirmed facts as highest-quality evidence; do not overwrite with inferred enrichment. Recognise former employees, bounced contact addresses, referrals, supplier negotiations and account-level suppression. Show account timelines.

### C. Prospect sourcing and research
Input XLSX/CSV >= 3,000 contact rows with streaming/chunked ingestion, preview, validation, resumability, original column preservation and reliable export; support all existing Cadence research/imported research docs, target lists and saved ICPs. Discover new companies and named decision-makers via permitted services, public sources and existing connected providers. Respect max contacts/company. For FastAmps default rank: Commercial Director > Procurement > Buyer > QS > MD/CEO; avoid outreach to dozens of QSes at companies where a senior decision maker is already active. Research projects, sector, public contracts, buildings, geography, stated procurement issues, technology needs, and verified contact roles. Every AI claim must link to source URL, publication/retrieval date and confidence. Reuse company research, cached contact info, known verified email patterns, and public research before spending provider credits. Inferred email patterns must be marked unverified; no blindly contacting unverifiable addresses. Track credits/cost caps and manual approval for expensive enrichment.

### D. Three campaign copy modes
1. **Strict Template**: exact subject/body template with allowed variables {first_name}, {company_name}, {job_title}, {project_name}, {sender_name}, {signature}; never alter wording outside fields. Validate every merge field.
2. **Research Assisted**: retain approved skeleton, insert one verified relevant observation or targeted introductory question; preserve word count/tone constraints.
3. **Fully Tailored**: compose a short individually reasoned message from verified company and contact intelligence and the campaign's approved offer. Make it sound genuinely human, not an AI sales sequence.

User-editable library of campaigns, prompt instructions, style/brand profiles, product USP sets, forbidden claims, banned phrases, subject formats, example emails and signature blocks. Scope all templates by org/brand/owner.

FastAmps default copy profile: short, direct, question first; no "hope you're well", no bold or long em dash in body; sell UK-manufactured 7.4 kW Alpha7, Bluetooth commissioning without live Wi-Fi, standard Wi-Fi, Ethernet where confirmed for the offered variant, optional 4G, CT load balancing, 3-year warranty, OCPP only when specifically verified as production-ready; preferred wholesaler supply route; a site visit/quick conversation. Never imply OCPP/Fuuse capability is certified/live before confirmed. Subject consistent and concise. No price/discount without approved offer and commercial confirmation.

B2B Sales Leads default profile: senior credible BDR/growth partner; avoid call-centre language and invented outcomes. Acid James: separate booking tone, audience, consent/legal segmentation and signature; never co-mingle datasets.

### E. Draft review and approval
Generate draft queue with table/grid filters: new intro, follow-up, reply, priority, source, company, owner, campaign, confidence. Allow multi-select, bulk review, manual editing, AI suggestion comparison, reject, snooze, regenerate, approve or unapprove. Show actual To/CC/BCC, sender, subject, body including signature and concrete evidence. Approvals bind to immutable message content hash, recipient, sender identity, campaign and sender account. Changing any field invalidates approval and prompts re-review. Separate approval from scheduling. Present a final count + timeframe + sender + risk preview before user triggers a schedule. Never send automatically upon import, AI generation or initial draft approval.

### F. Sending scheduler (only after sandbox QA)
Persistent queue with idempotency and leased workers, bounded throughput, provider quota awareness, UK timezone and user-defined working windows. Stagger for genuine operational deliverability, not for evasion; authenticate domains (SPF, DKIM, DMARC); prevent duplicates, resends or sending to blocked/unverified addresses. Recheck current approval hash, email identity, suppression, engagement/replies, bounce state, consent/lawful-basis flags and campaign status immediately before send. Manage 429/5xx with bounded retry and accurate provider confirmation, cancellation, pause, rollback/stop of unsent queue, audit events and visible scheduled/sent/failed status. Explicit approval for every outbound introductory message and follow-up. Default live sending OFF until a production release gate and user-enabled mailbox sending permission; test in a non-production mailbox only.

### G. Reply intelligence and follow-ups
Detect/label interested, wrong person, referral, unsubscribe, bounced, OOO, information requested, tender, meeting, not interested, manual review; uncertain decisions must be flagged, never autonomously responded to. Reply-aware stop across entire campaign; preserve conversation threading. Default follow-up drafts Day 0, +10 business days, ~Day 24, then pause; existing warm contacts/tenders have individual due dates and relationships override generic rules. Generate fresh contextual follow-ups and human reply suggestions, but require approval before sending. Allow snooze, reassign, complete, separate cold and warm lists.

### H. Multi-brand and tenant security
Per-organisation and per-user isolation enforced *server side* for companies, contacts, mailboxes, message bodies, attachments, drafts, sender identities, approval records and campaigns. No app-wide admin superuser shortcuts that leak mail content. Respect existing Cadence organisation membership and app roles. Secure storage/tokens/retention/export/deletion, audit read/write, lawful basis and opt-out registers. Track corporate versus individual subscriber status (UK GDPR/PECR) before sending; do not assume all DJs/promoters are corporate subscribers. Unsubscribe/objection must apply to every future campaign under relevant organisation. Privacy notices and lawful basis review required before B2B send lists.

## Agent operating model
**Master/Build Agent** owns backlog, branch, sequencing, integration architecture, tests and release gates. Delegate specialist work conceptually without overlapping code edits:
- **Inbox & UX Agent:** accessible and delightful client, editor, responsive behavior, minimal steps, anti-clutter.
- **Research & Contacts Agent:** imports, data provenance, dedup, ICP and economical enrichment.
- **Copy & Personalisation Agent:** template strictness, verified-tailoring, tone, signatures, response suggestions and human approval.
- **Mailbox Integration Agent:** OAuth, provider adapters, synchronization and message threading.
- **Sequence & Compliance Agent:** scheduling/limits, reply-aware stop, legal basis, suppressions.
- **QA & Security Agent:** independent negative tests and honest launch readiness; read-only in normal scheduled QA.

An independent scheduled QA subagent reviews branch without writing. The active Cadence Aileen Readiness agent owns existing beta; do not interfere.

## Milestones and release gates
M0: existing-app audit; evidence inventory, data model and feature flag plan; write a tested backlog.
M1: tenant-safe draft storage + beautiful Outreach UI; local compose/editor, templates and signatures, visible provider connect status. All controls actually work; no fabricated inbox.
M2: OAuth and consented mailbox sync + basic two-way draft management; per-user scopes and permissions tested.
M3: historical reconciliation, contacts/companies, 3k+ import tests, source-linked AI research and personalisation.
M4: real draft review queue, AI reply editor, immutable approvals and per-sender profiles.
M5: sandbox-only sending scheduler, replies, bounces, suppressions, follow-up sequences and accurate reporting.
M6: independent E2E, tenant-isolation and deliverability review; verify cold-start, provider errors, no duplicate send and read-only states. Merge tested UI under disabled live-send flag; then publish with rollback. Activate sending only after new consent, approval and proof.

Never mark a milestone "done" without specifying how it was tested (real provider journey vs simulation vs unit). Do not conflate preview with production publish, or a created connector with authorised access. Do not block safe no-send components unnecessarily while waiting for OAuth consent.

## Recurring development protocol
Each run: (1) check active app build and other agents; (2) read docs and last checkpoint; (3) select single highest-value, lowest-risk incomplete milestone; (4) make smallest coherent change on feature/cadence-outreach; (5) run tests and validate feature flag/tenant gates; (6) checkpoint; (7) update docs/CADENCE_OUTREACH_PROGRESS.md; (8) report verified changes, blockers and next step. Do not work asynchronously outside explicit authorised automation. Only merge/deploy after gates pass, keep live sending OFF by default. When provider consent is required, leave a clear in-app connect control.
