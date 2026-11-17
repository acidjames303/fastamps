# Paste into Base44 — Iteration 006 (Work pursuit / pose hold)

Preserve all 004 manners + 005 CTA clearance / Work `run` hops. Home choreography unchanged.

## Exact patch
In `useStickmanJourney` scroll chase **only when** `document.querySelector('[data-sm-work-page]')` is present:
1. Use a slightly snappier horizontal/vertical half-life while chasing the sample (e.g. HALF_LIFE 175 → ~120 on Work), **or**
2. When distance from motion to sample target exceeds ~80px, force `nextPose` to the sample travel pose (`run`/`jump`/`slide`/`swing`) instead of gait-idle.

Do not change PLAY_IDLE_MS / FLY_IDLE_MS / DOUBLE_TAP_MS / D-pad persistence.

## Acceptance
- Manners flags still pass
- `/work` scroll samples show fewer consecutive `pose-idle` mid-page
- CTA overlap remains 0
