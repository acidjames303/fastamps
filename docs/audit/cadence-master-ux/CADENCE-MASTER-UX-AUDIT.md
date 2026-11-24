# CADENCE — Master UX Audit, Gap Analysis & Implementation Roadmap

**Audit date:** 24 Nov 2026 (Europe/London)  
**Auditor role:** Product architecture + UX + AI feasibility + QA (observation only)  
**Isolated branch:** `cursor/cadence-ux-master-audit-2475`  
**Production changes:** None  
**Classification legend:** **Verified** = observed in live app / docs / API · **Inferred** = reconstructed from published bundle or prior eject · **Proposed** = recommendation only · **Not found** = searched and absent

---

## 1. Executive summary

### Critical finding (Verified)

The product described in the master brief — a multi-business sales operating system for JP, Aileen, Malcolm and callers, with campaigns, prospecting (Apollo/Lusha), calling, outreach, inbox, voice dictation and persistent campaign intelligence — **does not exist** in the live Cadence Base44 app, in this repository’s `main` branch, or in any Base44 app reachable with the credentials injected into this environment.

| Expected (brief) | Live Cadence (Verified) |
|---|---|
| Campaigns, ICP, prospecting, calling, outreach, inbox, team | **Absent** (0 keyword hits in production JS for campaign / prospect / Apollo / Lusha / calling / outreach / voice / spreadsheet / inbox / CRM) |
| Workspaces: FastAmps, Acid James, B2B Sales Leads | **Absent** |
| Roles: JP / Aileen / Malcolm / Colleen | **Absent** |
| Substantial sales functionality | **3 pages**, **1 entity**, client scoring + `InvokeLLM` drafts |

**What Cadence actually is today (Verified):**

- **Name:** Cadence  
- **Live URL:** https://cadence.base44.app  
- **What we inspected:** https://cadence.base44.app and Base44 id `6a7338f6106b1962aa31c00a`  
- **Owner correction (24 Nov 2026):** That CommDecide product is **not** James’s Cadence sales app. Treat prior “owner-confirmed” wording as **withdrawn**.  
- **Product on that URL/id:** Communication decision-support (meeting / email / async) — 3 pages, `CommunicationDecision` only  
- **James’s sales Cadence (campaigns / calling / prospecting / outreach):** **Not yet identified** — awaiting correct Base44 app URL or app id  

**Access note:** The agent token only lists **FastAmps Connect**. Until the correct Cadence app id/URL is provided (and a token that can open that workspace), the sales OS audit cannot proceed against the real product.

### Implication for the brief

Sections 5–21 of the brief cannot be audited as *existing* Cadence workflows. They can only be treated as a **product vision** (or a pointer to a different system not accessible here).

**Recommended first decision for James / JP (blocking):**

1. **Confirm target:** Is the sales OS (a) a greenfield rebuild *named* Cadence, (b) an expansion of the CommDecide Cadence app, or (c) a different Base44 app/URL we were not given access to?  
2. **Grant Cadence access:** Current `BASE44_API_TOKEN` only lists **FastAmps Connect**. Cadence API returns `ContainedAppNotFoundError`. Authenticated UX of Home / NewDecision / History could not be clicked through.  
3. **Do not start building the sales OS on assumptions** until (1) and (2) are resolved.

### What this audit *does* deliver

- Verified baseline of live Cadence (CommDecide)  
- UX findings for that product (P0–P2)  
- Inventory of adjacent products / branches that must not be disturbed  
- Feasibility of AI, voice, Outlook, ChatGPT/Cursor MCP on Base44 (from official docs)  
- A **conditional** roadmap: (A) fix & ship CommDecide Cadence, and/or (B) build the sales OS as a new Base44 app with phased IA  
- Smallest high-leverage next sprint recommendations

---

## 2. Scope, method & limits

### In scope

- Live anonymous surface of https://cadence.base44.app  
- Production JS/CSS bundle reverse-engineering  
- Prior Cadence audit + reconstructed source on `cursor/cadence-app-audit-ac95` (PR #5)  
- Base44 account apps visible to injected token  
- Related cloud-agent transcripts (Cadence browse, Cadence audit, playground mining)  
- Official Base44 docs: InvokeLLM, TranscribeAudio, Outlook connector, App MCP  
- Open PRs / development branches on `acidjames303/fastamps`

### Out of scope / blocked

| Item | Status |
|---|---|
| Authenticated Cadence session | **Blocked** — no Cadence login secret |
| Cadence Base44 editor / entities / RLS | **Blocked** — token cannot open Cadence app |
| Live production data mutation | **Not attempted** (rule) |
| Apollo / Lusha / calling / outreach in Cadence | **Not found** |
| Ringover “Cadence” HubSpot app | **Out of scope** (third-party product) |

### Evidence

| Asset | Path / URL |
|---|---|
| Login screenshot | [evidence/01-cadence-login.webp](./evidence/01-cadence-login.webp) |
| my-crm 404 | [evidence/02-my-crm-app-not-found.webp](./evidence/02-my-crm-app-not-found.webp) |
| Base44 editor login | [evidence/03-base44-editor-login-required.webp](./evidence/03-base44-editor-login-required.webp) |
| Production bundle | `/assets/index-BQoHtkdm.js` (~638 KB) — same hash as Nov 2026 prior audit |
| Prior audit | `docs/audit/cadence-base44-audit.md` on PR #5 |
| Hardening tree | `cadence/` on PR #5 (not deployed to live) |

---

## 3. Current application architecture (Verified + Inferred)

```
[Anonymous] cadence.base44.app
      → Base44 login shell
      → [Auth] Layout (Home | Start a new cadence | History | Logout)
            → Home (hero + feature cards — behind auth)
            → NewDecision
                  → intake form
                  → client DecisionEngine.score (live)  OR  generate-recommendation (PR #5 only)
                  → InvokeLLM draft (agenda | email | async)
                  → CommunicationDecision.create (live)  OR  save-decision (PR #5 only)
            → History
                  → entity.list (live, no client owner filter)
                  → archive via entity.update
```

**Stack (Inferred from bundle + reconstructed source):** React 18, Vite, React Router, Tailwind, Framer Motion, Sonner, Base44 SDK (`@base44/sdk`), `Core.InvokeLLM`.

**No custom backend functions** are invoked from the **live** client. PR #5 adds four functions but they are **not** on production.

**App ids:** `6a7338f6106b1962aa31c00a` / cadence.base44.app were audited as the published CommDecide tool and then **rejected by the owner as not their Cadence**. Do not use them as the sales OS target.

---

## 4. Existing feature inventory (Verified)

| Area | Present? | Detail |
|---|---|---|
| Auth (Google + email/password) | Yes | Login wall |
| Home / marketing hero | Yes | Behind auth |
| Intake wizard (`NewDecision`) | Yes | Title, purpose, urgency, complexity, decision types, stakeholders, emotional risk, change impact, cross-team, style, context |
| Rule-based channel scoring | Yes | meeting / email / async_message |
| LLM draft generation | Yes | InvokeLLM × 3 prompt shapes |
| History + archive | Yes | list + status=archived |
| Mobile bottom nav | Yes | Home / New / History |
| Multi-workspace | **No** | |
| Campaigns / ICP / ICPP | **No** | |
| Prospecting / Apollo / Lusha | **No** | |
| Calling / dialler / call lists | **No** | |
| Outreach sequences / templates | **No** | |
| Inbox / Outlook | **No** | |
| Voice dictation / STT | **No** | |
| Global search | **No** | |
| Role-based My Day | **No** | |
| Team / agency management | **No** | |
| Spreadsheets / CSV import | **No** | |
| Persistent campaign brain | **No** | |
| Cadence Intelligence chat | **No** | |

**Adjacent products in the same org (Verified, not Cadence):**

| Product | URL / id | Relevance |
|---|---|---|
| FastAmps Connect | `fastamps-connect` — installer growth network | Injected Base44 token targets this app only |
| SmartFunction Playground | `smartfunction.io/playground` · app `6afb374c…` | Workflow mapper; active hillclimb PR #9 — **do not interfere** |
| my-crm-3c45a1f2.base44.app | Mentioned in prior transcript | **404 App not found** today |

---

## 5. UX/UI findings — actual Cadence (CommDecide)

### 5.1 Information architecture

| Nav item | Destination | Friction |
|---|---|---|
| Home | Hero + CTAs | Product pitch locked behind login; login copy is generic |
| Start a new cadence | NewDecision | Label is long; route key is `NewDecision` |
| History | History | Clear |
| Logout | Auth | Clear |

**Where am I?** Partially clear (active nav).  
**Which business / campaign?** N/A — single-purpose personal tool.  
**What next?** Primary CTA is strong (“Find Your Cadence”); History empty state is weak without authenticated verification.  
**Saved?** Toast on save (reconstructed); live unverified without auth.

### 5.2 Primary journey — create a recommendation

| Step | Action | Friction |
|---|---|---|
| 1 | Log in | Signup / forgot-password reliability unclear (prior audit: links bounced) |
| 2 | Home → Find Your Cadence | Extra hop if user already knows the job |
| 3 | Fill intake (many fields on one form) | Cognitive load high for dyslexic users; not progressive “5 questions” despite marketing copy claiming 5 |
| 4 | Generate | Processing state exists; errors toast |
| 5 | Review recommendation + draft | Channel + draft in one view (good) |
| 6 | Save → History | Extra navigation; no “copy draft” prominence documented |

**Estimated clicks to first recommendation (Inferred):** Login + 1 CTA + form fill + submit ≈ **3 interactions + form**, not counting auth.

### 5.3 Visual & accessibility

| Finding | Priority | Notes |
|---|---|---|
| Dual branding Cadence vs CommDecide footer | **P0** | Confuses trust |
| Dark hero + form pages | — | Consistent enough for MVP |
| Purple/blue AI chrome | P2 | Matches brief’s “avoid AI purple cliché” only loosely |
| Mobile nav truncates “Start a new cadence” → “New” | P2 | Good progressive disclosure |
| Edit with Base44 badge (prior audit) | **P1** | Signals unfinished product |
| No public product story | **P1** | Meta description excellent; login is bare |
| Large form without progressive disclosure | **P1** | Conflicts with dyslexia / low cognitive-load goals in the brief |

### 5.4 Persona journeys from the brief

| Persona | Can they use live Cadence for their described job? |
|---|---|
| JP (platform owner / multi-business BD) | **No** — no workspaces, campaigns, calling, spreadsheets |
| Aileen (agency manager) | **No** — no team visibility, leads, approvals |
| Malcolm (CSV / LinkedIn / outreach) | **No** — no import or outreach |
| Callers (Colleen) | **No** — no call lists |

**These personas remain design targets for a future product, not audit subjects against live Cadence.**

---

## 6. Voice recognition (brief §11)

**Current Cadence:** No microphone, dictation, or `TranscribeAudio` usage in the production bundle (**Verified**).

**Therefore British accent “call → cool” issues cannot be reproduced in Cadence today.** If the team experiences that elsewhere (browser Web Speech API, another app, or a prototype), it is **not** in this published Cadence build.

### Feasibility on Base44 (Verified from docs)

| Capability | Base44 support | Notes |
|---|---|---|
| `TranscribeAudio` | Yes | Upload audio → transcript; ~1 credit/min; formats MP3/WAV/WEBM/…; 25 MB max |
| `GenerateSpeech` | Yes | TTS; 29 languages; not STT |
| Browser Web Speech API | Possible in custom UI | Often weak on UK accents — likely source of “call/cool” if used |
| OpenAI Whisper / transcription via own key | Possible | Base44 allows connecting own AI provider (API key as secret) |
| Command vs dictation separation | **Proposed** | Must be product design — not platform-native |

**Recommendation (Proposed):** For any future sales Cadence, prefer **Base44 TranscribeAudio or OpenAI transcription** over raw Web Speech API for UK sales notes; always show a review step before save/execute; never treat dictation as an executable command without confirmation.

---

## 7. AI integration feasibility (brief §7, §19)

### Verified Base44 capabilities (docs)

| Capability | Status | Use for vision |
|---|---|---|
| `InvokeLLM` (+ JSON schema, optional internet context, file_urls) | **Verified** | Intent parsing, brief extraction, email drafts, Q&A over structured context |
| Backend functions + entity permissions | **Verified** | Authorised function calling; never trust frontend filters alone |
| App MCP (OAuth) for ChatGPT / Claude / Cursor | **Verified** | External assistants act *as the signed-in user* on enabled entities/tools |
| Outlook connector (shared or per-user Graph) | **Verified** | Draft/send/read mail — prefer drafts + approval before send |
| UploadPublicFile / private files | **Verified** | CSV / PDF / brief uploads |
| AI Gateway / agents | **Verified** | Longer agent loops; more control than single InvokeLLM |
| Native Apollo / Lusha connectors | **Not verified** in Base44 docs scanned | Likely custom backend + stored API keys |
| Cursor subscription ⇒ Cadence data access | **False assumption** | Needs App MCP + OAuth + published tools |

### Architecture recommendation (Proposed)

**Primary:** Native Cadence Intelligence *inside* the app (command bar + optional panel) calling **existing backend functions** with workspace/campaign context and permission checks.

**Secondary:** App MCP with **Sign in required · OAuth** so JP can use Cursor/ChatGPT against the same authorised tools — optional, not required for Aileen/Malcolm.

**Avoid:** Requiring Cursor accounts for agency staff; inventing a parallel business-logic layer that duplicates entity rules; sending full tenant dumps to external models.

### Risk classification for AI actions (aligns with brief §18)

| Class | Examples | Gate |
|---|---|---|
| Read / navigate | Open campaign, show call list | Direct if permitted |
| Draft / reversible | Email draft, brief draft | Auto within permissions |
| Paid / external / destructive | Enrichment credits, send email, bulk delete | Explicit approval + audit log |

---

## 8. ChatGPT & Cursor options (brief §7)

| Option | Feasibility | UX fit | Security | Recommendation |
|---|---|---|---|---|
| **A. In-app Cadence Intelligence** | High on Base44 | Best for Aileen/Malcolm/callers | Functions enforce RLS | **Primary** |
| **B. Base44 App MCP → Cursor/ChatGPT** | High (docs) | Best for JP power workflows | OAuth + tool allowlist | **Secondary**, after entities exist |
| **C. Base44 platform MCP (sandbox edit)** | High | Builder-only | Builder credentials | Dev only — not end-user |
| **D. Assume ChatGPT Plus includes API** | — | — | — | **Do not** — separate API billing |

---

## 9. Recommended information architecture

### Path A — Keep CommDecide Cadence (small product)

```
Home → New recommendation → Result → History
Settings (invite policy, branding)
```

Ship P0/P1 polish; do **not** bolt sales OS onto this entity model.

### Path B — Sales operating system (new or renamed app) — Proposed IA

Hypothesis validated only after confirming no existing sales app:

| Primary nav | Job |
|---|---|
| **My Day** | Role-adaptive next actions |
| **Campaigns** | Context container (brain lives here) |
| **Prospecting** | Research / enrich / import |
| **Calling** | Focused call mode |
| **Outreach** | Drafts / templates / sequences (coordinate with any outreach agents) |
| **Inbox** | Leads, approvals, drafts — not a full email client |
| **Team** | Aileen: callers, progress, support |

**Admin / Integrations / Data** — secondary, never in the default caller chrome.

**Global chrome (always visible):** workspace switcher · active campaign · save state · Ask Cadence · search.

**Principle:** One campaign context retained across Prospecting ↔ Calling ↔ Outreach until explicitly changed.

---

## 10. Proposed conversational experience (Proposed — requires Path B)

- Global command bar (⌘K) + optional expandable panel  
- Intents resolve to **navigation or function calls**, not walls of chat  
- Manual UI always remains available  
- Voice = commands (confirm) vs dictation (review)  
- File upload attaches to the active campaign brief builder  

**Do not** ship a chatbot homepage that replaces My Day.

---

## 11. Campaign intelligence architecture (Proposed — Path B)

Structured, versioned **Campaign Knowledge** entity (or document store) per campaign:

- Brief, ICP, ICPP, exclusions, scripts, objections, qualification, tone prefs  
- Provenance fields (uploaded file / user edit / AI extraction)  
- Workspace + agency + client isolation  
- Corrections overwrite with history; no silent model “training”

Consumers: calling refresher, email drafts, prospecting filters, reporting.

---

## 12. Security & data governance

### Live Cadence (Verified risk)

| Risk | Priority | Notes |
|---|---|---|
| `CommunicationDecision.list` without client owner filter | **P0** | Entirely dependent on Base44 entity RLS — **unverified** without API access |
| Prompt injection via free-text title/purpose | **P1** | User text interpolated into InvokeLLM |
| Open signup vs invite-only unclear | **P1** | |
| PR #5 hardening not deployed | **P0** for any wider sharing | Owner-scoped functions exist only in repo |

### Sales OS (Proposed requirements)

- Server-side tenant/workspace checks on every AI tool  
- No cross-tenant search  
- Uploaded docs treated as data, not instructions  
- Audit log: user, workspace, campaign, action, outcome  
- External email send never automatic from AI alone  

---

## 13. Dependencies on existing development work

| Workstream | Branch / PR | Instruction |
|---|---|---|
| Cadence CommDecide hardening | PR #5 · `cursor/cadence-app-audit-ac95` | Reuse; deploy only after Cadence API access |
| FastAmps Connect launch / QA | PRs #10, #12, #13, #14 | **Do not interfere** |
| SmartFunction playground hillclimb | PR #9 | **Do not interfere** |
| Outreach agents (brief) | **Not found** as Cadence code | If they exist outside this repo, coordinate before Path B Phase 3–4 |

---

## 14. Implementation complexity (relative)

| Work | Complexity | Frontend | Backend | Depends on |
|---|---|---|---|---|
| CommDecide P0 branding + RLS + deploy PR #5 | Low–Med | Small | Med | Cadence API token |
| Path B data model (Campaign, Contact, Company, Activity…) | High | Med | High | Product confirmation |
| Role-based My Day + nav | Med | High | Med | Roles + seed data |
| Conversational campaign builder | High | High | High | InvokeLLM + knowledge entity |
| Prospecting providers | High | Med | High | Apollo/Lusha keys + credit ledger |
| Calling focus mode | Med–High | High | Med | Call list model |
| Voice (TranscribeAudio) | Med | Med | Low–Med | Mic UX + review step |
| Outlook draft workflow | Med | Med | Med | Outlook connector |
| App MCP external assistants | Med | Low | Med | Stable tools + OAuth |

---

## 15. Operating costs & API implications (order-of-magnitude)

| Driver | Base44 guidance (docs) | Implication |
|---|---|---|
| InvokeLLM | Credits per call; model choice affects cost | Cap auto-runs; prefer structured schema |
| TranscribeAudio | ~1 credit / minute | Save transcripts; don’t re-transcribe |
| SendEmail | ~1–2 credits | Prefer Outlook Graph for Aileen’s mailbox |
| Enrichment (Apollo/Lusha) | External billing | Credit-saving philosophy must be first-class |
| App MCP | Platform feature; tool abuse risk | Allowlist + approval classes |

Exact £ costs require Base44 plan + provider contracts — **not verified** in this audit.

---

## 16. Prioritised recommendations

### Against live Cadence (CommDecide) — do now if keeping the product

| ID | Item | Class |
|---|---|---|
| C-P0-1 | Fix CommDecide footer → Cadence; year | **P0** |
| C-P0-2 | Verify/lock entity RLS; deploy PR #5 owner-scoped functions | **P0** |
| C-P0-3 | Decide invite-only vs open signup; fix auth links | **P0** |
| C-P1-1 | Hide Edit with Base44 for end users | **P1** |
| C-P1-2 | Progressive intake (true short path) for dyslexia load | **P1** |
| C-P1-3 | Public landing *or* explicit invite-only positioning | **P1** |
| C-P2-1 | Nav label / route naming consistency | **P2** |

### Against the sales OS vision — only after product confirmation

| ID | Item | Class |
|---|---|---|
| S-P0-1 | Confirm app target + grant Cadence/sales API + QA login | **P0** |
| S-P0-2 | Tenant/workspace security model before any AI tools | **P0** |
| S-P1-1 | Phase 1: IA + role My Day + campaign context chrome | **P1** |
| S-P1-2 | Global search (keyword) | **P1** |
| S-P2-1 | Cadence Intelligence command bar → existing screens/functions | **P2** |
| S-P2-2 | Conversational + guided + upload campaign builder | **P2** |
| S-P2-3 | Persistent campaign knowledge | **P2** |
| S-P3-1 | Voice (TranscribeAudio) + command/dictation split | **P3** |
| S-P3-2 | Outlook draft→approve→send for Aileen | **P3** |
| S-P3-3 | App MCP for JP’s Cursor/ChatGPT | **P3** |
| S-P4-1 | Commercial packaging | **P4** — after internal adoption |

---

## 17. Proposed interface directions (Proposed — not built)

1. **CommDecide polish:** Calm single-column intake, 5 progressive questions, one primary CTA, Cadence branding only.  
2. **Sales My Day (caller):** One campaign card, Continue calling, follow-ups — no admin chrome.  
3. **Sales My Day (Aileen):** Active callers, leads awaiting review, drafts needing approval.  
4. **Ask Cadence:** Bottom/command entry; results open real screens.  
5. **Campaign header chip:** Persistent context across sections.

Wireframes intentionally deferred until Path A vs B is chosen — designing both in detail would add complexity the brief asks us to challenge.

---

## 18. Regression-testing strategy

### For CommDecide (Path A)

- Auth gate on all routes  
- Owner isolation: user A cannot list/archive user B decisions  
- Scoring golden tests (already in PR #5 `decisionEngine.test.mjs`)  
- LLM draft failure soft-handles without data loss  
- Mobile nav + desktop nav smoke  

### For Sales OS (Path B) — synthetic data only

Scenarios A–G from the brief, plus:

- Cross-workspace search returns empty for foreign tenants  
- AI cannot send email without approval  
- Campaign context survives Prospecting → Calling  
- Large CSV import does not crash; duplicates flagged  

---

## 19. Risks & blockers

| Risk / blocker | Severity | Mitigation |
|---|---|---|
| Brief assumes a product that is not live Cadence | **Critical** | Explicit product decision from JP |
| No Cadence API / login for this agent | **High** | Add Cadence-scoped token + QA user secrets |
| Building sales OS into CommDecide entity | **High** | Separate app or clear migration plan |
| Interfering with Connect / Playground / outreach agents | **High** | Isolated branch only (this PR); no deploys |
| Voice quality expectations without STT engine choice | **Med** | Benchmark TranscribeAudio vs OpenAI on UK samples before build |
| Cost runaway from InvokeLLM + enrichment | **Med** | Approval gates + credit ledger |

---

## 20. Recommended first implementation sprint

**Do not implement the sales OS in sprint 1.**

### Sprint 0 — Alignment (1 conversation with JP)

1. Confirm Path A vs Path B vs “other URL”.  
2. Provide Cadence Base44 access + read-only QA login.  
3. Point to any existing sales/outreach Base44 app if it exists outside this token’s visibility.

### Sprint 1A — If Path A (CommDecide)

1. Deploy PR #5 hardening to Cadence.  
2. Branding + invite policy + hide builder badge.  
3. Authenticated UX pass with screenshots.  
4. Measure: time-to-recommendation; ownership isolation test.

### Sprint 1B — If Path B (Sales OS)

1. Create **new** Base44 app (or confirmed target) — do not overload CommDecide.  
2. Implement workspace + campaign + role skeleton + My Day shells.  
3. Manual navigation only; no chatbot yet.  
4. Seed synthetic FastAmps campaign for JP/Aileen/caller views.  
5. Define function contracts for later Intelligence layer.

### Success criteria for “audit complete”

- [x] Live Cadence identity verified  
- [x] Feature inventory complete for published app  
- [x] Gap vs brief documented  
- [x] AI / voice / Outlook / MCP feasibility from official docs  
- [x] Isolated branch + roadmap for review  
- [ ] Authenticated deep UX — **blocked on secrets**  
- [ ] Sales OS code audit — **N/A until product located or greenfield approved**

---

## 21. Measurable baseline (what can be measured today)

| Metric | Baseline (Verified / Inferred) |
|---|---|
| Pages in Cadence | **3** |
| Entities | **1** |
| Steps to start “work” after login | Home → NewDecision (**1–2 clicks**) |
| Campaign create time | **N/A** — no campaigns |
| Calling start | **N/A** |
| Spreadsheet locate | **N/A** |
| NL navigation success | **0%** — no NL layer |
| STT accuracy | **N/A** — no STT |
| Cross-tenant leak tests | **Blocked** — need auth + second user |

---

## 22. Conclusion

Cadence today is a **tight, unfinished communication-decision MVP**. That is coherent product scope — and it is **not** the intelligent sales colleague described in the master brief.

The highest-leverage move is **not** to invent features on top of a mistaken inventory. It is to:

1. **Acknowledge the gap** (this document).  
2. **Choose Path A and/or Path B.**  
3. **Grant access** for a true authenticated audit if CommDecide Cadence remains in play.  
4. Only then implement the smallest slice that makes JP, Aileen, Malcolm and Colleen’s real day easier.

**Powerful underneath. Effortless on the surface.** — Start by putting the right product underneath.

---

*End of audit. No production deployment performed. No live data modified.*
