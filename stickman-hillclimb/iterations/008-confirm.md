# Iteration 008 — confirm consecutive ≥4.5 (2026-11-17, Europe/London)

## Lever
Confirm-only. No Base44 code change after 007.

## Playtest
```json
{
  "dpadPersists8s": true,
  "idleStillPlayingAt3_5s": true,
  "flyObserved": true,
  "workTravelPoses": 6,
  "workTravelVariety": 3
}
```
CTA overlap Home/Work: **0**. `prefers-reduced-motion: reduce` → stickman unmounted. Toss after play: stays `playing` with D-pad.

## Rubric
Same as 007 — **average 4.56**. Second consecutive ≥4.5 with no regressions.

## Definition of done
- [x] Home + Work intentional (anchors + Work travel poses)
- [x] Play discoverable without arcade-first paint (scroll-gated Try-me)
- [x] Walk / jump / fly / land / toss / patient idle / persistent D-pad
- [x] Rubric ≥4.5 on two consecutive iterations (007 + 008)
- [x] Must-fix gates all green
