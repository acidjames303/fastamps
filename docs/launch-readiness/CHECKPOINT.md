# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Cycle | 0 |
| Clean cycles | 0 / 3 |
| Phase | inspect → publish gate → authorised simulation |
| Environment | dry-run |
| Simulation prefix | QA-LAUNCH-2026 |
| Base44 app id | `6adf6de7ebdb4cb382e8779f` (FastAmps Connect) |
| Base URL | https://connect.fastamps.com |

## Next action

1. Keep all probes pinned to app id `6adf6de7ebdb4cb382e8779f` (`npm run assert-app` / smoke).
2. **Publish** branch `cursor/launch-readiness-qa-fb1b` / PR #10 to Base44 so privacy/terms, PWA icons and freeze-compliant fixes reach this app.
3. Obtain **admin + installer QA credentials** (or isolated deployment of the same app id).
4. Explicitly authorise production stress with `CONNECT_QA_MODE=production-authorised` + `CONNECT_QA_CONFIRM=QA-LAUNCH-2026` **or** isolated URL.
5. Run Cycle 1: smoke → 1 installer E2E → 5 concurrent → scale toward 20×20 / 400 installs.
6. Giftbit: readiness check only; no chargeable orders.

## Blockers

- Launch fixes not fully live on this app (PWA still Base44 logo; privacy/terms + Alpha 7 still in live JS).
- No authorised production stress confirmation yet.
- No Base44/admin API credentials in this agent environment for creating QA-LAUNCH-2026 accounts/imports.
- Giftbit live GBP fulfilment unverified (non-fulfilment boundary).

## Notes

Target verified via HTML `appId`, JS `defaultValue:"6adf6de7ebdb4cb382e8779f"`, and `GET /api/apps/public/login-info/by-id/6adf6de7ebdb4cb382e8779f` → name FastAmps Connect. Feature freeze remains in force.
