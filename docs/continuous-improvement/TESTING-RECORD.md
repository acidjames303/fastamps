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
