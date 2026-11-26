# FastAmps Connect — release verification gate

Updated: 2026-11-26 (Europe/London)

## Production source of truth

| Layer | Mechanism | Notes |
| --- | --- | --- |
| Live domain | https://connect.fastamps.com | Cloudflare → Base44/uvicorn |
| Frontend | Vite `dist/` published via Base44 `deploy-dist` | Fingerprint: `assets/index-*.js` |
| Backend functions | Base44 `coding/redeploy-function` + `POST /deploy` | |
| Entity schemas | Must be re-pushed **after** `POST /deploy` | See `DEPLOY_PRESERVE.md` |
| Git repository | github.com/acidjames303/fastamps | Does **not** auto-deploy on push |

**A successful Git push, PR merge, Base44 save, or local build does NOT equal a production deployment.**

## Required publish sequence

Use:

```bash
CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
  node launch-readiness/simulation/src/deploy-preserve.mjs
```

Then verify:

```bash
npm run ops:verify-release -- --skip-build --record
# or full rebuild + compare:
npm run ops:verify-release -- --record
```

## Verification checklist (every release)

1. `npm test` passes  
2. `npm run build` succeeds  
3. Functions redeployed (if changed)  
4. `POST /deploy` completed  
5. Entity schemas re-pushed from `base44/entities/*.jsonc`  
6. `deploy-dist` of current `dist/`  
7. Live domain serves expected SPA asset name + markers (`/welcome`, `/pre-register`)  
8. Installer schema still has `membership_status`  
9. Genuine Links programme still `draft` unless intentionally activated  
10. Append line to `ops/deployment-history.jsonl` via `--record`  

If any step fails: report **`DEPLOYMENT UNVERIFIED`** — do not claim success.

## Autonomous publish policy

Until explicitly authorised by JP:

- Do **not** auto-deploy bugfixes to production from CI.
- Prepare PRs with verified local/build evidence.
- Security, financial, permission, and schema-changing releases need explicit approval (except a documented emergency runbook).

## Rollback

1. Identify last `VERIFIED` entry in `ops/deployment-history.jsonl`.  
2. Rebuild that git SHA.  
3. Run `deploy-preserve.mjs` from that checkout.  
4. Re-run `ops:verify-release`.  
