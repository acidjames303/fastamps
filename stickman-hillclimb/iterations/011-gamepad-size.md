# Iteration 011 — larger play control hit targets (2026-11-17, Europe/London)

## Lever
`PlayControls.jsx`: gamepad/pause `h-7`→**`h-9`**, D-pad `h-7`→**`h-8`**, icons slightly larger. Checkpoint `6afcb3d675d852c7c5c70f95` deployed.

Why: three maintenance feel-passes missed the ~28px gamepad; optional lever from iter 010.

## Playtest
Manners/Work flags still green (identical to 010 lock):
```json
{
  "dpadPersists8s": true,
  "idleStillPlayingAt3_5s": true,
  "flyObserved": true,
  "workTravelPoses": 6,
  "workTravelVariety": 3
}
```
Live gamepad bounding box now **36×36**. Playwright click enters play.

## Feel pass
computerUse still failed to enter play after enlarge — likely agent click/desktop occlusion, not live regression (Playwright counter-check + elementFromPoint on SVG child still triggers button).

## Rubric
Discoverability slight ↑; avg holds **≥4.56**. Anti-gimmick OK (no new chrome).

## NEXT
Maintenance. No further lever unless real user regression.
