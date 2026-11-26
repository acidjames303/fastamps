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
