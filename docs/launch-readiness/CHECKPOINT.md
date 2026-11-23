# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Cycle | 2 (authorised production QA — in progress) |
| Clean cycles | 0 / 3 |
| Phase | publish cleared → authenticated claims → scale toward 20×20 |
| Environment | production-authorised (user completed setup actions) |
| Simulation prefix | QA-LAUNCH-2026 |
| Base44 app id | `configured Base44 Connect app id` (FastAmps Connect) |
| Base URL | https://connect.fastamps.com |

## Cycle 2 progress (2026-11-23)

| Check | Result |
| --- | --- |
| App id pin | **verified** |
| Frontend `deploy-dist` from PR branch | **ok** (`2026-11-23T11:56:27Z`) |
| Smoke publish blockers | **none** (privacy/terms live; PWA icons FastAmps; Alpha-7 unlock tile gone) |
| Admin login API | **ok** |
| Installer login API | **ok** |
| Browser installer/admin login UI | **ok** ([Authenticated Connect login smoke](bc-643b42dc-4d5e-5cb2-a213-5c1d8178ec2b); artifacts `/opt/cursor/artifacts/auth-smoke/`) |
| Live `/privacy` + `/terms` (browser) | **ok** — full content (was 404 pre-publish) |
| Admin import `QA-LAUNCH-2026-CYCLE2-25` | **25 chargers created** |
| Install claims submitted | **5 / 5 ok** (`QA-LAUNCH-2026-S00001`–`S00005`) via existing installer account |
| Giftbit | still non-fulfilment — no chargeable orders |

Browser UI confirmed admin overview totals (installers / awaiting review / available chargers) and installer home. This does **not** yet equal three clean 20×20 cycles — still **CONDITIONAL GO**.

## Blockers / constraints

1. **20 distinct installer accounts:** registration requires email OTP. Provided credentials are existing real users (not `QA-LAUNCH-2026-*` synthetics). Full 20×20 concurrency needs either OTP inbox access or pre-created synthetic installer accounts.
2. Workspace CLI deploy key (`b44k_…`) still not required after successful `deploy-dist` with personal token.
3. Remaining 395 installs + 15 installer identities still outstanding for exit criteria.

## Next action

1. Create or obtain **20 `QA-LAUNCH-2026` installer identities** (OTP / invite path).
2. Import remaining charger buffer (up to 420) under QA batch refs.
3. Scale claims: 1 → 5 → 10 → 20 concurrent sessions.
4. Admin reconciliation during load; Giftbit readiness only.
5. Aim for three consecutive clean critical cycles after last P0/P1.

## Notes

Feature freeze remains in force. Production mutations this cycle were limited to QA-prefixed charger imports and install claims. Do not issue real Giftbit rewards for QA rows.
