# Cadence continuous improvement — release history

## CI cycle 1 — 25 Nov 2026 (Europe/London)

**Branch:** `cursor/continuous-improvement-agent-2475`  
**Focus:** Establish CI agent artefacts + highest-impact safe UX: research on Dialer + confirm-for-calling.

### Issue identified

1. AccountResearch from Prospecting was only copied into CompanyIntelligence at push time; dig-deeper / later research did not appear on Dialer with source URLs.
2. Provider-returned mobiles required buried “Use this number”; Confirm did not mark the prospect call-ready.

### Changes made

- Living CI docs + `.cursor/rules/cadence-continuous-improvement.mdc` + AGENTS.md pointer + Automations setup notes.
- Dialer loads matching `AccountResearch` and BriefPanel shows findings with evidence + source links.
- Prospecting: visible “Confirm for calling” when a usable number exists but is not yet verified/manually confirmed; PhoneCandidates Confirm also sets `phone_status: manually_confirmed` when appropriate.

### Data / security impact

Read-only research fetch on Dialer; optional Prospect/ContactPhone status updates already within existing entity permissions. No schema, secrets, auth, or billing changes.

### Publishing status

Code on `cursor/continuous-improvement-agent-2475` + PR. Unit test + production build passed. **Base44 production deploy held** — app only exposes `main`; live Dialer/Prospecting UI verify and a Builder rollback checkpoint are required before autonomous publish (see TESTING-RECORD).

### Rollback

Revert the PR / restore prior BriefPanel + PhoneCandidates + ProspectTable commits. No migrations.

### Next priority

CI-003 multi-file campaign ingest, or Dialer session continuity — whichever scores higher after live verification.

---

## CI cycle 2 — 25 Nov 2026 evening (Europe/London)

**Focus:** Publish cycle 1 + reduce Prospecting research clutter.

### Changes
- Base44 production deploy of cycle 1 (Dialer research + Confirm for calling). Rollback SHA recorded in RELEASE notes / agent checkpoint.
- Unified ProspectResearchWorkspace (Quick / Custom / Import tabs) — same APIs, progressive disclosure.
- Removed duplicate Enrich CTA when the table already shows Enrich; trimmed push helper noise.

### Publishing
Deployed via `base44 deploy -y --build` to production app (cadence.smartfunction.io / evasive-dial-flow-go). Cycle 2 UX redeployed after build in same evening session.

---

## CI cycle 3 — 25 Nov 2026 evening (Europe/London)

From [Audit UX simplification targets](bc-cf3a114d-337f-5ea2-acc9-17450afa29d9) / `AUDIT-CYCLE-2.md`.

### Changes
- **CI-011:** SelectiveEnrichDialog confirm-first (Maximum summary + estimate + Start; Adjust search for full controls). Same `startEnrichmentJob` payload.
- Removed people-v3 banner; removed unused EnrichmentCostPreview mount.

### Publishing
Redeploy after build in this cycle.

---

## CI cycle 4 — 25 Nov 2026 ~21:00 (Europe/London)

Overnight timer. **CI-014:** Campaigns Prospecting/Import tabs use one clear heading + back to campaigns (no competing “Campaigns” hero + Find prospects chrome). Nav labels aligned to Prospecting. No API changes.

### Next
CI-005 Team metrics clarity (calls/hour vs login duration).

---

## CI cycle 5 — 26 Nov 2026 ~00:00 (Europe/London)

**CI-005:** Team page clarifies live heartbeat vs performance. Call rows show attempts, conversations, minutes on calls, and attempts/hour derived from `duration_seconds` (not login). Idle → “In Cadence”; Offline → “No recent activity”. Additive fields on `getTeamWorkload` only.

### Next
CI-006 Admin Inbox → prefilled lead sheet, or CI-003 multi-file ingest — pick highest safe impact.

---

## CI cycle 6 — 26 Nov 2026 ~03:00 (Europe/London)

**CI-006:** Admin Inbox is now Info requests + Qualified leads. Copy lead summary prefills company/contact/qualification (no internal notes, no auto-send). Dialer shows link after Qualified save. Team page surfaces both panels.

### Next
CI-003 multi-file campaign ingest, or CI-007 reporting + lead sheets together.

---

## CI cycle 7 — 26 Nov 2026 ~06:00 (Europe/London)

**CI-007:** Results **Client pack** downloads the existing client activity CSV plus a `.txt` of client-safe lead summaries for qualified opportunities in the same campaign/date filter. No email send; confidential notes omitted.

### Next
CI-003 multi-file / multi-worksheet campaign ingest (largest remaining P1), or CI-004 outreach research reuse.

---

## CI cycle 8 — 26 Nov 2026 ~07:30 (Europe/London)

**CI-003:** Spreadsheet import now merges **every worksheet** in an Excel file (and multiple uploaded files), instead of keeping only the single “best” sheet. Same Base44 Prospect/list APIs; local `xlsx` parse + existing AI extract fallback. Summary feedback shows file/sheet counts.

### Data / security
No schema, secrets, or provider API changes. Import still writes Prospects via existing `bulkCreate`.

### Next
CI-004 Outreach research reuse, or further Import.jsx / NL campaign ingest polish.

---

## CI cycle 8b — 26 Nov 2026 ~09:30 (Europe/London)

James confirmed live Prospecting is **Campaigns → Find prospects → Import existing research → Company list** (`SpreadsheetImportPreview` in Base44 sandbox), not the git-only `CsvAccountsUpload` surface.

### Changes
- Sandbox `SpreadsheetImportPreview` merges every worksheet + multi-file via `accountsFromSheets` / `mergeAccountLists`.
- Dropzone copy: “every worksheet · multiple files”; preview/summary show worksheet counts.
- Synced `campaign-builder/` into git so this path is the source of truth going forward.
- Published live via `base44 site deploy --publish` (bundle `index-CIflvdVW.js`).

---

## Sync fix — 26 Nov 2026 ~09:50 (Europe/London)

**Problem:** Git `cadence-sales` had drifted from the production Cadence Base44 app (`BASE44_APP_ID`) (parallel ProspectStart UI). Edits/demos hit the wrong surface.

**Fix:** Re-synced `cadence-sales/src` (+ `base44/`) from the live eject of the production Cadence Base44 app. Prospecting again uses `CampaignBuilderWorkspace` / Find prospects / Company list. Guardrail rule `.cursor/rules/cadence-live-app-source.mdc` added. No second Base44 app was created.

---

## Checkpoint + UX import — 26 Nov 2026 ~09:55 (Europe/London)

1. Sandbox checkpoint **before UX import** (`6b0802040fe4a123818d2637`).
2. Re-imported CI-003 Company list UX into the production app sandbox (Find prospects path only).
3. Sandbox checkpoint **CI-003 Company list multi-worksheet UX import** (`6b08024b0e74ae5ed82356b1`).
4. `base44 site deploy --publish --build` — live still serves Company list · every worksheet · multiple files.

---

## CI-015 — 26 Nov 2026 ~10:05 (Europe/London)

James reported the Company list still looked unchanged (CI-003 was merge logic + copy). Visible polish on **Campaigns → Find prospects → Import existing research → Company list** only:

- Fanned spreadsheet icons + “Drag and drop or choose file”
- Per-file reading queue with type chips + progress
- Stat tiles (companies / new / worksheets / files) and **Worksheets merged** breakdown
- Clearer section eyebrow/heading; research pack card as “next” step
- Checkpoints: `6b08038085787a512f9e0de8` (before) · `6b08038d6e589fe7ef45645d` (CI-015)
- Live bundle `index-B6_qyEG-.js`

---

## CI-016 — 26 Nov 2026 ~10:25 (Europe/London)

**Root cause of “I can’t see anything”:** Find prospects showed the old four equal Get Started cards plus the legacy brief/company form. Company list UX only appeared after an extra click, so most of the screen never changed.

**Fix (visible on first paint):**
- Campaigns → Find prospects now **opens Import → Company list by default**
- Get Started redesigned: large “Start with the research you already have” / **Open company list** primary card
- Legacy brief/company tools collapsed under “Classic brief & company tools (optional)”
- Fanned worksheet icons always visible (not hover-only)
- Checkpoints: `6b080933…` before · `6b08095a…` CI-016
- Live bundle `index-D0ikBivf.js`

---

## CI-017 — 26 Nov 2026 ~11:15 (Europe/London)

Fluent Find prospects start — less clunky, same core features.

**Kept:** Guide me (pills) · Dictate · Write · Import existing research.

**UX:**
- Four equal start cards again (“How do you want to start?”) — no forced Import landing
- Import is one column: company list → optional “Attach research documents” → compact next-step chips
- Removed duplicate research upload + always-open “Prompt your accounts” stacked under the builder
- Prompt research / more tools collapsed so they do not compete with starting

Checkpoints: `6b0813a9…` before · `6b0813d3…` CI-017

---

## CI-018 — 26 Nov 2026 ~11:25 (Europe/London)

Four-way Find prospects hub matching how James starts work:

1. Import existing research  
2. Describe my campaign (pills / dictate / type)  
3. Continue an existing campaign  
4. Start from a template  

Workflow chips: Start → Companies → Review → Enrich → Call/Outreach → Results.  
Live bundle `index-Cnv1JfxO.js`. Audit: `docs/CADENCE_UX_RELEASE_AUDIT.md`.

---

## CI-019 — 26 Nov 2026 ~12:00 (Europe/London)

Phase 2 guided workflow:

1. Campaign **Recommended next** (add companies / find contacts / activate / call)  
2. Today **what next** strip (callbacks vs build pipeline)  
3. Unified import — removed Import CSV tab; redirects into Find prospects Import  

Live bundle `index-B0J2UY2L.js`.

---

## CI-020 — 26 Nov 2026 ~12:15 (Europe/London)

Overnight cycle. **Today → Dialer one-click resume.**

**Before:** Callers returning to Cadence opened Today, then had to remember which campaign/company they were on and re-navigate Dialer manually (queue position only resumed after reopening the same list).

**After:** Dialer persists a `lastDialResume` snapshot (company, list, campaign name). Today’s **what next** strip shows **Continue at {company}** with **Open Dialer** → `/dialer?list=&company=`. Callbacks still outrank resume.

**Where:** Today (`/app`) → Open Dialer; Dialer saves resume whenever the active company changes.

**Checks:** unit `campaign-next-action.test.mjs` pass · `npm run build` pass · live `index-DyWTON_g.js` with Continue at / Open Dialer / cadence_last_dial_  
Checkpoints: `6b081fa3…` before · `6b081fe0…` CI-020  

**Next:** CI-021 post-enrichment results + next action in place.

---

## CI-021 — 26 Nov 2026 ~15:00 (Europe/London)

Overnight cycle. **Post-enrichment · what next.**

**Before:** Enrichment complete banner only offered “Review results → /prospecting”; batch summary showed metric cards with no guided next step; toast said “Open Prospecting”.

**After:** Shared `enrichmentNextAction` drives banner, batch summary and toast:
- Numbers found → **Start calling** (+ Open Outreach)
- Emails/contacts only → **Open Outreach**
- Mostly failures → **Show needs attention** (filters table when already on Prospecting)

**Where:** Campaigns → Find prospects (after enrichment) · header completion toast  

**Checks:** unit `enrichment-next-action.test.mjs` pass · build pass · live `index-mMKAvHBw.js` with Enrichment · what next · Ready to call  
Rollback SHA: `f590efb` · Checkpoints: `6b084a3b…` before · `6b084a76…` CI-021  

**Next:** CI-022 manager needs-attention rollup on Campaigns.

---

## CI-026 — 26 Nov 2026 ~17:45 (Europe/London)

**BDM Split data** on Campaigns (+ Campaign setup Assign step).

Modes: Even / 50-50 · By territory (UK regions) · By industry · Dictate / describe (rules + Base44 AI fallback).  
Server `assignCampaignCompanies` extended; seed Prospects resolved to Companies when needed.  

Live `index-B7DR3dFn.js`. Rollback `71e466c`.  
**Next:** CI-022 manager needs-attention rollup.

---

## CI-022 — 26 Nov 2026 ~18:05 (Europe/London)

**Manager needs-attention rollup** on Campaigns.

Compact amber strip at the top of Campaigns for managers: companies / contacts / activate / no callers / info requests.  
**Show only these** filters the list. Inline Activate / Split data / Open inbox.

Live `index--5WydKF3.js`. Rollback `cd15bb7`.  
**Next:** CI-027 Split data from Find prospects import next-steps.

---

## CI-028 — 26 Nov 2026 ~18:40 (Europe/London)

**Pilot phone audit** (original Excel vs Cadence Contacts CSV).

Findings: **0 import mobiles replaced**; Lusha filled empty mobiles; additive second mobiles not visible in that export (schema/export gap).

Shipped: persist `lusha_mobile` on Prospect/Contact · ContactPhone candidates · Prospecting **Phone audit CSV** · person card shows Lusha mobile · re-enrich keeps import provenance.

Live `index-DqF9udQx.js`. Rollback `e68284c`.  
**Next:** CI-027 Split data from Find prospects import next-steps.

---

## CI-028b — 26 Nov 2026 ~18:45 (Europe/London)

**Seek extra Lusha mobiles beside existing import numbers** on re-enrich (`force_refresh` / “Also seek extra mobiles…”).

Previously Lusha phone reveal skipped anyone who already had a mobile — so additive seconds never appeared (audit: 0/1088). Import numbers stay primary; extras go to `lusha_mobile`.

Live `index-D0LQ5sRG.js`. Rollback `cb89447`.


---

## CI-023 — 26 Nov 2026 ~17:00 (Europe/London)

Zenitech pilot data readiness (two Excel files from James).

**Files analysed**
- `Zenitech Current Clients & Prospects` — 19 unique client names (exclusion / do-not-prospect)
- `B2B Sales Pilot` — 1,634 contacts · 162 companies · mobiles/directs/industries

**Gaps found**
1. Exclusion ICP field existed but was not enforced on discovery/import  
2. Company-list import ignored `Mobile phone`, `Direct Phone Number`, `Primary Industry`, LinkedIn URL, Country  
3. Enrichment could overwrite an existing mobile with a Lusha number  
4. Export had no separate Import mobile / Lusha mobile columns  

**Shipped**
- Exclusion file import on Structured ICP + skip on Company list import + filter in `discoverCompanies`  
- Spreadsheet column aliases + mobile/direct preserved with `phone_source: import`  
- Enrichment keeps existing numbers; stores additional Lusha as `lusha_mobile`  
- Export headers **Import mobile** · **Lusha mobile**  
- Import preview shows industry hints for lookalike ICP  

Live `index-Bp_nqzgH.js`. Rollback `31895f4`.  
**Next:** CI-022 manager needs-attention rollup.
