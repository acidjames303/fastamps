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
