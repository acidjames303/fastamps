# Cadence continuous improvement — testing record

## CI cycle 1–2 — 25 Nov 2026 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `account-research-match.test.mjs` | **Pass** | normalise, match, needsCallReadyConfirm |
| `npm run build` (cadence-sales) | **Pass** | vite production build |
| Secrets / .env not committed | **Pass** | |
| No live email / TPS of customer numbers | **Pass** | Not exercised |
| Base44 production deploy | **Pass** | cycle 1 + cycle 2 via `base44 deploy` |
| Live host HTTP 200 | **Pass** | cadence.smartfunction.io |
| Live bundle strings | **Pass** | Confirm for calling · Research once · Prospecting research · people-v3 |
| Authenticated Dialer/Prospecting click-through | Pending | Next overnight cycle with test account |

## Overnight

Timer `cadence-ux-overnight` every **3 hours** — one UX reduction per cycle; low-risk frontend publish after tests.

## CI cycle 8 — 26 Nov 2026 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `spreadsheet-accounts-merge.test.mjs` | **Pass** | Multi-sheet merge, contact merge, tiny-sheet not dropped |
| Unit: prior CI tests | **Pass** | account-research-match, lead-sheet-summary, results-lead-pack |
| `npm run build` (cadence-sales) | **Pass** | vite production build |
| Secrets / hardcoded app id | **Pass** | No new secrets |
| Base44 production deploy | **Pass** | `base44 deploy -y --no-build`; App URL evasive-dial-flow-go |
| Live host HTTP 200 | **Pass** | cadence.smartfunction.io serves `index-IvPdQtHO.js` |
| Live bundle strings | **Pass** | “every worksheet · multiple files”; sheet-count summary copy |


## CI cycle 8b — 26 Nov 2026 (Europe/London)

James's live path is Campaigns → Find prospects → Import existing research → **Company list** (`SpreadsheetImportPreview`), not `CsvAccountsUpload`.

| Check | Result | Notes |
|---|---|---|
| Sandbox edit + checkpoint | **Pass** | `CI-003: Company list merges every Excel worksheet` |
| Site deploy `--publish` | **Pass** | bundle `index-CIflvdVW.js` |
| Live copy on Company list | **Pass** | “every worksheet · multiple files” + Import existing research |

## Checkpoint + UX re-import — 26 Nov 2026 ~09:55 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Pre-import checkpoint | **Pass** | `6b0802040fe4a123818d2637` — before UX import 2026-11-26 |
| Sandbox write Company list UX | **Pass** | `spreadsheetAccounts.js`, `SpreadsheetImportPreview.jsx`, `ImportResearchSection.jsx`, `CampaignBuilderWorkspace.jsx` |
| Post-import checkpoint | **Pass** | `6b08024b0e74ae5ed82356b1` — CI-003 Company list multi-worksheet UX import |
| Site deploy `--publish --build` | **Pass** | evasive-dial-flow-go / cadence.smartfunction.io |
| Live bundle strings | **Pass** | Company list · every worksheet · multiple files · Find prospects (`index-CIflvdVW.js`) |

## CI-015 visible Company list UX — 26 Nov 2026 ~10:05 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Pre-import checkpoint | **Pass** | `6b08038085787a512f9e0de8` |
| Sandbox write | **Pass** | `SpreadsheetImportPreview.jsx` + `ImportResearchSection.jsx` |
| Post checkpoint | **Pass** | `6b08038d6e589fe7ef45645d` — CI-015 visible Company list import UX |
| Site deploy `--publish --build` | **Pass** | bundle `index-B6_qyEG-.js` (changed from `index-CIflvdVW.js`) |
| Live strings | **Pass** | Campaigns · Find prospects · Drag and drop or · choose file · Worksheets merged · Reading every worksheet |
| Visual preview | **Pass** | `/opt/cursor/artifacts/ci015-company-list-ux/` fanned icons (auth blocks live click-through) |

## CI-020 Today→Dialer resume — 26 Nov 2026 ~12:15 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `campaign-next-action.test.mjs` | **Pass** | Includes `resume_dial` when `lastDialResume` set; callbacks still win |
| `npm run build` (cadence-sales) | **Pass** | → `index-DyWTON_g.js` |
| Sandbox write + checkpoint | **Pass** | before `6b081fa3…` · CI-020 `6b081fe0…` |
| Site deploy `--publish --build` | **Pass** | cadence.smartfunction.io |
| Live bundle strings | **Pass** | Continue at · Open Dialer · resume_dial · cadence_last_dial_ · Resume where you left off (`index-DyWTON_g.js`) |
| Component preview screenshots | **Pass** | `/opt/cursor/artifacts/ci020-today-dialer-resume/` + `docs/audit/ci020-today-dialer-resume/` |
| Authenticated live click-through | **Blocked** | No invitation login session in this agent environment |
| Secrets / schema / live email | **Pass** | localStorage only; no API/schema changes |

## CI-021 post-enrichment what next — 26 Nov 2026 ~15:00 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `enrichment-next-action.test.mjs` | **Pass** | call / outreach / failures / session fallback |
| Unit: `campaign-next-action.test.mjs` | **Pass** | Regression |
| `npm run build` (cadence-sales) | **Pass** | → `index-mMKAvHBw.js` |
| Sandbox write + checkpoint | **Pass** | before `6b084a3b…` · CI-021 `6b084a76…` |
| Site deploy `--publish --build` | **Pass** | cadence.smartfunction.io |
| Live bundle strings | **Pass** | Enrichment · what next · Ready to call · Start calling · Open Outreach (`index-mMKAvHBw.js`) |
| Component preview screenshots | **Pass** | `/opt/cursor/artifacts/ci021-enrichment-next/` + `docs/audit/ci021-enrichment-next/` |
| Authenticated live enrichment run | **Blocked** | No login session; would also spend provider credits |
| Secrets / schema / live email | **Pass** | Frontend-only; no enrichment API changes |

## CI-023 Zenitech exclusion + pilot import — 26 Nov 2026 ~17:00 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `spreadsheet-accounts-merge.test.mjs` | **Pass** | B2B pilot column aliases |
| Unit: `company-exclusion.test.mjs` | **Pass** | Zenitech sheet parse + filter |
| Pilot dry-run `toAccounts` | **Pass** | 162 companies · 1,240 contacts with phones · industries mapped |
| Zenitech exclusion parse | **Pass** | 19 unique names |
| `npm run build` | **Pass** | → `index-Bp_nqzgH.js` |
| Site deploy `--publish --build` | **Pass** | Live: do-not-prospect · excluded clients skipped · Industries in this file |
| Authenticated import of James’s files | **Blocked** | No login session |
| Live Lusha enrich on pilot | **Not run** | Would spend credits |

## CI-026 BDM Split data — 26 Nov 2026 ~17:45 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `split-campaign-data.test.mjs` | **Pass** | Territory / industry / even / dictate parse |
| `npm run build` | **Pass** | → `index-B7DR3dFn.js` |
| Site deploy `--publish --build` | **Pass** | Live strings: Split data · By territory · Dictate / describe |
| Authenticated split on live campaign | **Blocked** | No login session |

## CI-022 Manager needs-attention rollup — 26 Nov 2026 ~18:05 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `campaign-attention.test.mjs` | **Pass** | companies / contacts / activate / callers / IRs |
| Unit: `campaign-next-action.test.mjs` | **Pass** | Regression |
| `npm run build` | **Pass** | → `index--5WydKF3.js` |
| Site deploy `--publish --build` | **Pass** | Live: Needs attention · Show only these · Ready to activate |
| Authenticated Campaigns rollup | **Blocked** | No login session |

## CI-028 Pilot vs Cadence phone audit — 26 Nov 2026 ~18:40 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Diff original XLSX vs Cadence Contacts CSV | **Pass** | 1,079 mobiles preserved · **0 replaced** · 24 filled empty |
| Unit: `prospect-phone-audit-export.test.mjs` | **Pass** | Import vs Lusha columns |
| `npm run build` | **Pass** | → `index-DqF9udQx.js` |
| Site deploy `--publish --build` | **Pass** | Live: Phone audit CSV · Lusha mobile |
| Re-enrich with credits | **Not run** | Owner will retry; agent must not spend credits |

## CI-027 Split data on import next-steps — 26 Nov 2026 ~21:05 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `split-campaign-data.test.mjs` | **Pass** | Regression |
| Unit: `campaign-next-action.test.mjs` | **Pass** | Regression |
| `npm run build` | **Pass** | → `index-1R3E4eHI.js` |
| Site deploy `--build` | **Pass** | Live `index-1R3E4eHI.js` on cadence.smartfunction.io |
| Authenticated import → Split | **Blocked** | No login session |

## CI-024 + CI-034 Outreach pre-OAuth — 26 Nov 2026 ~22:00 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `company-exclusion.test.mjs` | **Pass** | mergeTargetSectors + parseListIcp |
| Unit: `enrichment-next-action.test.mjs` | **Pass** | `/outreach?page=campaign_studio` |
| `npm run build` | **Pass** | → `index-Bl6OesW8.js` (pre-deploy) |
| Secrets / send / OAuth | **Pass** | No live mailbox or send exercised |
| Site deploy `--publish --build` | **Pass** | Live `index-dbYBU5IZ.js` on cadence.smartfunction.io |
| Live bundle strings | **Pass** | Use as target sectors · Inbox waits until you connect · Open campaign in Outreach · page=campaign_studio |
| Authenticated Outreach click-through | **Blocked** | No login session; owner connects email tomorrow (CI-035) |

## CI-025 Multi-number phone candidates expanded — 27 Nov 2026 ~00:05 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `prospect-phone-signals.test.mjs` | **Pass** | import+Lusha expands; single mobile does not |
| `npm run build` | **Pass** | → `index-dI9sQ7Ah.js` |
| Secrets / credits / send | **Pass** | Frontend-only |
| `base44 deploy -y --build` | **Pass** | Live `index-dI9sQ7Ah.js` · **All held numbers** |
| Authenticated multi-number expand | **Blocked** | No login session |

## CI-004 Research reuse Dialer → Outreach — 27 Nov 2026 ~03:10 (Europe/London)

| Check | Result | Notes |
|---|---|---|
| Unit: `outreach-research-reuse.test.mjs` | **Pass** | pickableFindings dedupe |
| Unit: `account-research-match.test.mjs` | **Pass** | Restored helper |
| `npm run build` | **Pass** | → `index-dWBVxLKA.js` (pre-deploy) |
| Credits / send / secrets | **Pass** | Paid suggest still opt-in; reuse is free |
| Site deploy | Pending | After commit |
