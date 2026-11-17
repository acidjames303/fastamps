# Iteration 010 — scheduled maintenance (2026-11-17, Europe/London)

## Lever
None. Done criteria already locked on 007–008 (avg 4.56×2).

## Playtest vs 009
Flags **identical** — no regression:
```json
{
  "dpadPersists8s": true,
  "idleStillPlayingAt3_5s": true,
  "flyObserved": true,
  "workTravelPoses": 6,
  "workTravelVariety": 3
}
```

## Feel pass
Discovery + Work scroll still good. computerUse again failed to enter play via gamepad click; Playwright counter-check immediately entered play (`sm-playing` + D-pad). Treat as agent hit-target miss on ~28px control, not a live regression.

## Optional future lever (not applied)
Slightly enlarge gamepad hit target (`h-7 w-7` → `h-9 w-9`) + clearer hover — improves thumb/agent discoverability without arcade chrome. See `prompts/NEXT_BASE44.md`.

## Rubric
Hold **4.56**. No deploy.
