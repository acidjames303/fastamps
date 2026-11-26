# Cadence UX visibility, integration & deployment audit

**Date:** 26 Nov 2026 (Europe/London)  
**Production host:** https://cadence.smartfunction.io  
**App id:** from `BASE44_APP_ID` / `VITE_BASE44_APP_ID` only  
**Working branch:** `cursor/continuous-improvement-agent-2475`  
**Repo HEAD at publish:** see latest commit on that branch  
**Live bundle after CI-018:** `index-Cnv1JfxO.js`

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
