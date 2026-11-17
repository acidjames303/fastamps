# Iteration 009 — scheduled maintenance cycle (2026-11-17, Europe/London)

## Lever
None. Definition of done already met on 007–008 (avg 4.56×2). This cycle is a regression watch.

## Playtest vs 008
Identical flags — no regression:
```json
{
  "mountedHome": true,
  "mountedWork": true,
  "dpadPersists8s": true,
  "stillPlayingAtDpadCheck": true,
  "idleStillPlayingAt3_5s": true,
  "idleStillPlayingAt9s": false,
  "flyObserved": true,
  "workTravelPoses": 6,
  "workTravelVariety": 3
}
```

## Feel pass
- Try-me absent on first paint; appears after scroll ✓
- Work scroll landings/slides feel integrated ✓
- computerUse reported play entry broken — **false negative**: Playwright re-verified gamepad click + double-click both enter play with D-pad; Esc exits. Likely agent click-target miss on the small gamepad hit box.

## Rubric
Hold **4.56**. No new Base44 prompt / no code change.

## Next
Stay maintenance. Only open a new lever if a future cycle shows flag regression or a real user-visible play-entry bug.
