# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Cycle | 1 (dry-run) |
| Clean cycles | 0 / 3 |
| Phase | publish gate → authorised simulation |
| Environment | dry-run (no `CONNECT_QA_MODE=production-authorised`) |
| Simulation prefix | QA-LAUNCH-2026 |
| Base44 app id | `6adf6de7ebdb4cb382e8779f` (FastAmps Connect) |
| Base URL | https://connect.fastamps.com |

## Cycle 1 dry-run results (2026-11-23)

| Probe | Result |
| --- | --- |
| `node src/dry-run.mjs` | **ok** — 20 installers, 420 serial/PIN pairs, QA prefix OK |
| `node src/smoke.mjs` | **ok: false** — publish blockers below |
| `node src/concurrency-plan.mjs` | **ok** — stages 1→5→10→20 gated pending credentials |

### Smoke `publishBlockers`

1. `privacy_terms_not_in_live_bundle` — live JS lacks Privacy/Terms page copy; SPA shell HTTP 200 but client route is **Page Not Found**
2. `pwa_icon_still_base44` — live `manifest.json` still uses `https://base44.com/logo_v2.svg`
3. `alpha_7_still_in_live_bundle` — live JS still contains “20 installs unlock a free Alpha 7” tile (removed in source)

### Live client evidence

- `/privacy` → client **404** (“The page "privacy" could not be found in this application.”) — `/opt/cursor/artifacts/cycle1-smoke/privacy.png`
- `/terms` → client **404** (“The page "terms" could not be found in this application.”) — `/opt/cursor/artifacts/cycle1-smoke/terms.png`
- `/` login shell loads (Connect branding OK) — `/opt/cursor/artifacts/cycle1-smoke/home.png`
- Observation: Facebook/Apple social icons broken on live login (CDN `cdn.simpleicons.org` Cloudflare-challenged); freeze-compliant inline SVG fix landed in source this cycle.

Source already has Privacy/Terms routes, FastAmps PWA icons, and Alpha-7 tile removal — **not live until Base44 publish**.

## Next action

1. Keep probes pinned to app id `6adf6de7ebdb4cb382e8779f`.
2. **Publish** branch `cursor/launch-readiness-qa-fb1b` / PR #10 to Base44 so privacy/terms, PWA icons, Alpha-7 tile removal, and social-icon SVG fix reach `connect.fastamps.com`.
3. Obtain **admin + installer QA credentials** (or isolated deployment of the same app id).
4. Explicitly authorise production stress with `CONNECT_QA_MODE=production-authorised` + `CONNECT_QA_CONFIRM=QA-LAUNCH-2026` **or** isolated URL.
5. Re-run smoke (expect zero publish blockers) → 1 installer E2E → 5 concurrent → scale toward 20×20 / 400 installs.
6. Giftbit: readiness check only; no chargeable orders.

## Blockers

- Launch fixes not fully live (PWA Base44 logo; privacy/terms + Alpha 7 still in live JS).
- No authorised production stress confirmation yet.
- No Base44/admin API credentials in this agent environment for creating QA-LAUNCH-2026 accounts/imports.
- Giftbit live GBP fulfilment unverified (non-fulfilment boundary).

## Notes

Target verified previously via HTML `appId`, JS `defaultValue:"6adf6de7ebdb4cb382e8779f"`, and public login-info API → name FastAmps Connect. Feature freeze remains in force. No production data mutation this cycle.
