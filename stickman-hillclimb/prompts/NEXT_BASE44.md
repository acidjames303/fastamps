# Paste into Base44 — Iteration 007 (confirm Work + quiet discovery)

Preserve 004–006: manners timings, CTA `-56` clearance, Work `run` hops, Work chase / travel-pose hold.

## This round (pick ONE)
**Preferred:** Confirm-only — no code change. Re-run playtest; if `workTravelPoses ≥ 5` and manners flags still green, lock Work polish at 4.2+ for consecutive-average tracking.

**If discovery still feels gamey:** In `StickmanOverlay.jsx`, show `Try me` only after the first scroll movement (`scrollY > 40`) rather than a fixed 3.6s timer; keep copy and fade life the same. Do not change play HUD.

## Do not
New features, arcade chrome, Home chase speed changes, manners constant changes.

## Acceptance
- `dpadPersists8s`, `idleStillPlayingAt3_5s`, `flyObserved` true
- `workTravelPoses` ≥ 5 / `workTravelVariety` ≥ 3
- CTA overlap remains 0
