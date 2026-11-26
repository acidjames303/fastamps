# FastAmps Connect — Security, Maintenance & Release Guardian

Updated: 2026-11-26 (Europe/London)  
Production: https://connect.fastamps.com  
Branch: `cursor/security-maintenance-guardian-fb1b`

## Executive summary

Production deployment integrity for the current SPA fingerprint was **VERIFIED** against a fresh rebuild. A zero-AI monitoring stack was added via repository scripts + GitHub Actions schedules. Continuous monitoring is **CONFIGURED** in code; it becomes **ACTIVE** only after GitHub Actions secrets are present and a workflow run succeeds.

No V1 commercial rules, Giftbit live payouts, or genuine Links activation were changed.

---

## Step A — Production audit

| Item | Finding |
| --- | --- |
| Live SPA | `assets/index-Ct1Q8Oqd.js` + `assets/index-Cp-4XN_J.css` |
| Fresh local rebuild | Same SPA filenames after `npm run build` |
| Hosting | Cloudflare + Base44/uvicorn; HTML `no-store`; assets `max-age=604800` |
| Backend publish | Base44 redeploy-function + `POST /deploy` + schema re-push + `deploy-dist` |
| Git push auto-deploy? | **No** |
| Schema live | `Installer.membership_status` present; `qa_financial_lifecycle` present |
| Genuine Links | `draft`, `active:false` |
| Giftbit mode (env) | Testbed |
| Build risk found | `qrcode` missing from `node_modules` in this VM until `npm install` — declared in `package.json` |

---

## Capability matrix

| Capability | Status | Evidence | Remaining risk / approval |
| --- | --- | --- | --- |
| Prove live SPA version | **Implemented & verified** | `npm run ops:verify-release` | Pin `EXPECTED_SPA_JS` repo variable |
| Deployment verification gate | **Implemented** | `docs/ops/RELEASE_VERIFICATION.md`, `ops/scripts/verify-release.mjs` | Autonomous prod publish **not** authorised |
| Persistent deployment history | **Implemented** | `ops/deployment-history.jsonl` | Append on every verified release |
| Deploy-preserve process | **Implemented (prior)** | `launch-readiness/simulation/src/deploy-preserve.mjs` | Still mandatory after `/deploy` |
| Uptime / health every 15 min | **Configured, pending CI secrets** | `.github/workflows/production-monitor.yml` | Mark ACTIVE after first green scheduled run |
| 5-minute external uptime | **Not implemented** | — | Optional free UptimeRobot/Better Stack |
| Security smoke | **Implemented** | `ops/scripts/security-smoke.mjs` | Brute-force controls are Base44-owned |
| Intrusion analytics 24/7 | **Not active** | Documented gap | Needs log export/SIEM |
| Alerting | **Partial** | Workflow opens `ops-alert` issues on failure; webhook optional | Test `HEALTH_WEBHOOK_URL` before claiming email/Slack |
| Regression unit tests | **Implemented** | `npm test` (18) | Expand journey coverage gradually |
| Critical workflow E2E in CI | **Partial** | Launch harnesses exist; not all wired to Actions | Avoid live Giftbit / real users |
| Auto bug repair pipeline | **Documented process** | This report + release gate | No silent auto-deploy of sensitive fixes |
| Weekly ops review | **Configured** | `.github/workflows/weekly-ops.yml` | First Monday run after secrets |
| Ops dashboard UI in product | **Not implemented** | State JSON + docs instead | Avoid installer UX disruption |
| AI-free routine monitoring | **Implemented by design** | Scripts + Actions only | Keep weekly AI sessions bounded |

---

## Step B — Publishing verification

Command:

```bash
npm run ops:verify-release -- --skip-build --record
```

Verdict labels:

- `VERIFIED` — live SPA + schema/programme checks pass; optional local match  
- `DEPLOYMENT UNVERIFIED` — do not claim success  

---

## Step C — Security baseline

See `docs/ops/SECURITY_BASELINE.md`.

Priority risks:

1. Platform auth abuse controls not visible in-repo  
2. npm audit high findings need weekly triage  
3. QA credential rotation still blocked  

---

## Step D — Monitoring independent of Cursor

| Component | Runs when Cursor closed? |
| --- | --- |
| GitHub Actions `production-monitor` (cron */15) | **Yes**, after merge + secrets |
| GitHub Actions `weekly-ops` | **Yes** |
| `ops/scripts/*` locally/CI | **Yes** |
| Cursor Cloud Agent always-on | **No** — not relied upon |

Until the first successful Actions run with secrets: status remains **CONFIGURED_PENDING_CI_SECRETS** in `ops/maintenance-state.json`.

Required GitHub secrets (names only): `BASE44_APP_ID`, `BASE44_API_KEY`, `CONNECT_QA_ADMIN_EMAIL`, `CONNECT_QA_ADMIN_PASSWORD`, optional installer pair, optional `HEALTH_WEBHOOK_URL`.  
Optional variable: `EXPECTED_SPA_JS`.

---

## Steps E–G — Repair / release / schedule

- Detect → Investigate → Fix → Test → Publish (`deploy-preserve`) → Verify (`ops:verify-release`) → Record  
- Max one small UX improvement per weekly session when healthy  
- Security/P0 always first  
- Incentive amounts / Giftbit live / Links activation: **approval required**  

---

## What JP must do

1. Merge this guardian PR (or stack) into the integration branch.  
2. Add GitHub Actions secrets listed above.  
3. Manually run workflow **Production monitor** once; confirm green.  
4. Optionally set `EXPECTED_SPA_JS=assets/index-Ct1Q8Oqd.js` (update when SPA hash changes after verified deploys).  
5. Optionally add a free 5-minute external uptime check pointing at https://connect.fastamps.com.  
6. Rotate QA cohort passwords when Base44 admin tooling allows.  

---

## Commercial safeguards (unchanged)

- Links Electrical Shrewsbury: **draft**  
- No genuine charger codes generated by guardian work  
- Giftbit live auto-fulfilment: blocked  
- QA/demo records remain excluded from commercial reporting  
- Incentive model not modified  

---

## Honest non-claims

- We do **not** claim 24/7 intrusion prevention beyond Base44/Cloudflare defaults.  
- We do **not** claim email/Slack alerts until webhook delivery is tested.  
- We do **not** claim autonomous production hotfixes are authorised.  
- We do **not** claim Cursor itself keeps the app monitored when closed — GitHub Actions does (once secrets land).  
