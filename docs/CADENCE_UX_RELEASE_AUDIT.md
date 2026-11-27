# Cadence UX visibility, integration & deployment audit

**Date:** 26 Nov 2026 (Europe/London)  
**Production host:** https://cadence.smartfunction.io  
**App id:** from `BASE44_APP_ID` / `VITE_BASE44_APP_ID` only  
**Working branch:** `cursor/continuous-improvement-agent-2475`  
**Repo HEAD at publish:** see latest commit on that branch  
**Live bundle after CI-023:** `index-Bp_nqzgH.js`

---

## A. What was stopping changes from appearing

| Cause | Verified? | Evidence |
|---|---|---|
| Edits landed on nested Import UI while Find prospects still showed Get Started / legacy chrome | **Verified** | Earlier cycles polished `SpreadsheetImportPreview` while the tab still opened a different composition |
| CI-016 forced Import as default (`preferImport`), so the redesigned start hub was skipped | **Verified** | Prior code set `preferImport={embedded}` and always `return "import"` |
| Improvements buried under duplicate Research upload + Prompt panels | **Verified** | James’s screenshot showed Company list + research upload + Prompt your accounts stacked |
| App defaults to **Today**, so Campaigns → Find prospects is not the first screen | **Verified** | Navigation / role routing; Find prospects requires `canProspect` |
| Audit’s “production revision `65efa396…`” is a **Base44 sandbox git hash**, not the GitHub repo SHA | **Verified** | Sandbox checkpoints return `gitCommitHash` like `65efa396…`; GitHub HEAD is separate (`56f1d2c` → CI-018) |
| Passing unit tests ≠ browser-visible UX | **Verified** | Prior cycles claimed success from build/deploy strings while James still saw Import clutter |
| Cache | **Ruled out for latest cycles** | Live HTML is `cache-control: private, no-store`; bundle hash changed (`CQSl0nbT` → `Cnv1JfxO`) |

---

## B. Improvement status table

| Improvement | In source | On branch | Built | Deployed live | In normal nav | Role-gated | Browser-verified |
|---|---|---|---|---|---|---|---|
| CI-003 multi-worksheet company import | Yes | Yes | Yes | Yes | Find prospects → Import | `canProspect` | Bundle strings + prior sandbox path |
| CI-015 visible company dropzone | Yes | Yes | Yes | Yes | Import path | `canProspect` | Component preview |
| CI-016 forced Import landing | Reverted by CI-017/018 | Yes | Yes | N/A (replaced) | Was hiding hub | — | — |
| CI-017 declutter import / collapse prompt | Yes | Yes | Yes | Yes | Find prospects | `canProspect` | Bundle `DHfsmHX` then superseded |
| **CI-018 four-way start hub** | Yes | Yes | Yes | **Yes `index-Cnv1JfxO.js`** | **Campaigns → Find prospects** | `canProspect` | Live bundle strings + local component screenshots |
| Guide me (pills) | Yes | Yes | Yes | Yes | Describe → Answer with pills | `canProspect` | Code path intact |
| Dictate / Write brief | Yes | Yes | Yes | Yes | Describe → Dictate / Type | `canProspect` | Code path intact |
| Continue existing campaign | **Newly exposed on hub** | Yes | Yes | Yes | Continue card | `canProspect` | Preview screenshot |
| Start from template | **Newly exposed on hub** | Yes | Yes | Yes | Template card | `canProspect` | Preview (list in props) |
| Caller (Aileen) Dialer / Today | Unchanged this cycle | — | — | Live | Today / Dialer | Caller roles | Not re-tested this cycle |
| CSV export one-row-per-contact | Prior fix preserved | Yes | Yes | Assumed live | Results / export | Authorised roles | Not re-run at 3k this cycle |

---

## C. What we fixed (CI-018)

| Problem | Fix | Screen | Verification | Commit | Deployment | Screenshot |
|---|---|---|---|---|---|---|
| Start options not obvious; Import hid other methods | Four-way hub: Import / Describe / Continue / Template + workflow chips | Campaigns → Find prospects | Live bundle contains “How do you want to find prospects?” | This branch tip | Production site deploy `--publish` | `/opt/cursor/artifacts/ci018-find-prospects-hub/01-four-way-hub.png` |
| Describe path buried | Describe expands to pills / dictate / type (same GuidedBuilder / WritePanel) | Same → Describe | Preview | Same | Same | `02-describe-expanded.png` |
| Continue / templates buried in review | Continue lists campaigns/lists; Template lists built-in + saved | Same | Preview | Same | Same | `03-continue-expanded.png` |
| Stacked research chrome | Research docs under Import accordion; prompt collapsed | Import + below | Code + prior CI-017 | Same | Same | James prior shot vs new hub |

**Base44 checkpoints:** `6b081691…` before · `6b0816b6…` CI-018

---

## D. Where to see the improvements

1. Open https://cadence.smartfunction.io  
2. Go to **Campaigns** (not Today).  
3. Open the **Find prospects** tab.  
4. You should see **“Find prospects · start here”** and **“How do you want to find prospects?”** with four cards.  
5. If you are already inside Import, click **“How do you want to find prospects?”** at the top to return to the hub.

**Role note:** Find prospects requires `admin`, `sales_manager`, or `platform_owner` (`canProspect`). Callers (Aileen) correctly do not see this tab.

---

## E. Test results

| Check | Result |
|---|---|
| Live HTML bundle hash | `index-Cnv1JfxO.js` |
| Live strings for hub | Pass (How do you want to find prospects? · Import · Describe · Continue · Template · 1. Start) |
| Sandbox write of hub files | Pass |
| Site deploy `--publish --build` | Pass |
| Authenticated live click-through (JP/Malcolm/Aileen) | **Blocked** — no session credentials in this agent environment; login is invitation-only |
| Tablet / mobile authenticated | **Blocked** — same |
| 3,000-contact export soak | Not re-run this cycle (prior export fixes preserved; no schema change) |

---

## F. Build and release status

| Item | Value |
|---|---|
| Branch | `cursor/continuous-improvement-agent-2475` |
| PR | https://github.com/acidjames303/fastamps/pull/18 |
| Production publish | `base44 site deploy --publish --build` against env app id |
| Live confirmation | Bundle `index-Cnv1JfxO.js` on cadence.smartfunction.io |
| Competing agents | No queued Cursor follow-ups at time of publish |

---

## G. What still needs attention (priority)

1. **Authenticated browser smoke as JP** on Campaigns → Find prospects hub (release confidence).  
2. Soften or merge Campaigns **Import CSV** tab with Find prospects Import to reduce duplicate doors.  
3. Today page CTA for `canProspect` users: “Continue finding prospects”.  
4. Malcolm / Aileen journey walkthrough with real roles.  
5. Large-list import + export regression at 3k+ rows.

---

## Phase 2 — CI-019 guided next actions (26 Nov 2026 ~12:00 Europe/London)

JP confirmed CI-018 hub is visible. This cycle targets connected workflow friction, not another start-hub redesign.

### Three improvements (scored & shipped)

| # | Problem | Fix | Where | Impact |
|---|---|---|---|---|
| 1 | Campaign cards show many equal buttons — unclear what to do next | **Recommended next** from company/contact/status | Campaigns list | One primary action: Add companies → Find contacts → Activate → Start calling |
| 2 | Today is the home screen but does not guide pipeline builders or resume callers | **Today · what next** strip | Today (`/app`) | Callers see callbacks; JP/Malcolm see Find prospects when queue empty |
| 3 | Duplicate **Import CSV** tab vs Find prospects Import | Removed Import CSV tab; `/import` and `?tab=import` redirect to Find prospects Import | Campaigns nav | One import door |

### Verification

| Check | Result |
|---|---|
| Unit `campaign-next-action.test.mjs` | Pass |
| `npm run build` | Pass → `index-B0J2UY2L.js` |
| Live cadence.smartfunction.io bundle | **`index-B0J2UY2L.js`** with Today · what next · Recommended next · Build today's pipeline |
| `Import CSV` label count in live bundle | **0** |
| Authenticated E2E | Still blocked (no login session) — component screenshots + live string proof |
| Screenshots | `docs/audit/ci019-guided-next/` |
| Checkpoints | `6b081e58…` before · `6b081eb1…` CI-019 |

### Next three priorities (for following runs)

1. ~~Today → Dialer continuity~~ → **CI-020 done** (below).  
2. After enrichment completes: surface useful results + recommended next (call / outreach) in-place → **CI-021 next**.  
3. Manager “needs attention” rollup across campaigns without leaving Campaigns → **CI-022**.

---

## Phase 2 — CI-020 Today→Dialer resume (26 Nov 2026 ~12:15 Europe/London)

Overnight timer cycle. Highest-impact remaining item from Phase 2 reassessment.

### Problem → fix

| Before | After | Where |
|---|---|---|
| Returning callers had to remember campaign + company and dig back into Dialer | Today shows **Continue at {company}** · **Open Dialer** deep-links to `/dialer?list=&company=` | Today (`/app`) |
| Queue position only helped after already opening the same list | Dialer writes `lastDialResume` (companyId, name, listId, campaignName) on company change | Dialer |
| Risk of resume overriding urgent work | Callbacks / overdue still outrank resume in `todayNextAction` | Today · what next |

### Verification

| Check | Result |
|---|---|
| Unit `campaign-next-action.test.mjs` | Pass (resume + priority) |
| `npm run build` | Pass → `index-DyWTON_g.js` |
| Live cadence.smartfunction.io | **`index-DyWTON_g.js`** contains Continue at · Open Dialer · cadence_last_dial_ |
| Screenshots | `docs/audit/ci020-today-dialer-resume/` |
| Authenticated E2E | Still blocked (no login session) |
| Checkpoints | `6b081fa3…` before · `6b081fe0…` CI-020 |

### How to see it live

1. Open https://cadence.smartfunction.io and sign in (caller or any dialling role).  
2. Work a company in **Dialer** (list + company).  
3. Go to **Today**.  
4. With no due/overdue callbacks, the strip should read **Continue at {company}** with **Open Dialer**.

### Next (do not re-audit)

- ~~CI-021~~ → **done** (below)  
- **CI-022** Manager needs-attention rollup on Campaigns  
- **CI-004** Research reuse across Dialer & Outreach  

---

## Phase 2 — CI-021 post-enrichment what next (26 Nov 2026 ~15:00 Europe/London)

Overnight timer cycle after CI-020.

### Problem → fix

| Before | After | Where |
|---|---|---|
| Done banner only linked “Review results” to `/prospecting` | **Enrichment · what next** with Start calling / Open Outreach / Show needs attention | EnrichmentSessionBanner |
| Batch summary was metrics-only | Same guided strip from real phone/email/fail counts | EnrichmentBatchSummary |
| Header toast said “Open Prospecting” | Toast CTA follows the same next-action helper | EnrichmentProgressIndicator |

### Verification

| Check | Result |
|---|---|
| Unit `enrichment-next-action.test.mjs` | Pass |
| `npm run build` | Pass → `index-mMKAvHBw.js` |
| Live cadence.smartfunction.io | **`index-mMKAvHBw.js`** with Enrichment · what next · Ready to call |
| Screenshots | `docs/audit/ci021-enrichment-next/` |
| Authenticated enrichment E2E | Blocked (no login; would spend credits) |
| Checkpoints | `6b084a3b…` before · `6b084a76…` CI-021 |

### How to see it live

1. Open https://cadence.smartfunction.io → **Campaigns → Find prospects**  
2. Run (or wait for) enrichment on a list  
3. When complete, the banner shows **Enrichment · what next** with **Start calling** / **Open Outreach** (or needs-attention)

### Next

- **CI-022** Manager needs-attention rollup on Campaigns  
- **CI-004** Research reuse across Dialer & Outreach  

---

## Zenitech pilot capability check — CI-023 (26 Nov 2026 ~17:00 Europe/London)

### What James needs

| Need | Before CI-023 | After CI-023 |
|---|---|---|
| Exclude current Zenitech clients from prospecting | ICP had `excluded_companies` text only — **not enforced** on discovery/import | Import Excel/CSV into Excluded companies; Company list import + `discoverCompanies` skip matches |
| Import B2B pilot (~1.6k contacts) with mobiles/directs | Import **dropped** Mobile phone, Direct Phone, Primary Industry, LinkedIn, Country | Columns mapped; contacts keep mobile + direct; `phone_source: import` |
| Do not overwrite existing numbers on enrich | Existing unprotected mobiles could be replaced by Lusha | Existing number stays primary; Lusha stored as `lusha_mobile` |
| Export Lusha separately | Single “Phone source” string | **Import mobile** and **Lusha mobile** export columns |
| Find similar verticals from pilot industries | Possible only if ICP sectors typed by hand | Import preview lists industries to copy into Target sectors; discovery uses ICP + exclusions |

### How to use live

1. Open campaign → brief / structured ICP → **Excluded companies** → upload Zenitech clients Excel → Save  
2. **Campaigns → Find prospects → Import** → upload B2B pilot → confirm phones/industries in column mapping → import  
3. Copy industry hints into **Target sectors** → run company discovery / Find similar — clients stay excluded  
4. Enrich named contacts — existing mobiles kept; Lusha extras appear as Lusha mobile on export  

### Still open (not blocking this release)

- One-click “add these industries to ICP” (CI-024) — **done**  
- Show Lusha extra numbers inline / ContactPhone always expanded for multi-number (CI-025) — **done**  
- Authenticated dry-run of James’s exact files in production (login blocked here)  
