# Base44 deploy preserve process

Updated: 2026-11-24 (Europe/London)

## Problem

`POST /api/apps/{id}/deploy` publishes backend functions but can also rewrite live **entity schemas** from a stale git revision associated with the Base44 app. That previously stripped `Installer.membership_status` / `welcome_reward_status=deferred`, which caused an eligibility probe to create an unintended claim.

A full deploy can also overwrite the published SPA. Always restore with `deploy-dist`.

## Required sequence

Use the harness:

```bash
CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
  node launch-readiness/simulation/src/deploy-preserve.mjs
```

It always:

1. Builds the SPA (`npm run build`) unless `--skip-build`
2. Redeploys selected backend functions (`coding/redeploy-function`)
3. Runs `POST /deploy` (publish functions)
4. **Re-pushes every local `base44/entities/*.jsonc` schema after publish**
5. Publishes `dist/` via `deploy-dist`
6. Verifies SPA markers (`/welcome`, `/pre-register`, `/admin/programmes`) and Installer schema fields

## Manual equivalent

1. Redeploy changed functions  
2. `POST /api/apps/{id}/deploy`  
3. `PUT` each entity schema from repo JSONC (or `POST` if missing)  
4. `deploy-dist` of current `dist/`  
5. Verify SPA asset hash + schema fields + programme draft status

## Do not

- Run `POST /deploy` alone and assume schemas/SPA are intact
- Activate `links-electrical-shrewsbury` without JP approval
- Import genuine manufacturing codes into virtual simulation batches
