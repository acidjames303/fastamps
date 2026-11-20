# Iteration 007 — Try-me after first scroll (2026-11-17, Europe/London)

## Lever
`StickmanOverlay.jsx`: replace fixed 3.6s timer with **scroll gate** (`scrollY ≥ 40`), then 7s fade. Checkpoint `6afca40f24804b013954453d` deployed.

## Evidence
- Before scroll: `.sm-try-hint` = null (even after 4.5s)
- After scroll 120px: `Try me · gamepad or double-click`
- Playtest flags unchanged / green:
```json
{
  "dpadPersists8s": true,
  "idleStillPlayingAt3_5s": true,
  "flyObserved": true,
  "workTravelPoses": 6,
  "workTravelVariety": 3
}
```

## Rubric scores (1–5)
| Criterion | Score | Note |
|-----------|------:|------|
| Discoverability | 4.5 | Invitation after first scroll, not first paint |
| Play-mode clarity | 5 | Chip + legend + D-pad |
| Motion smoothness | 4 | Continuous; still room for micro-feel |
| Fly feel | 4.5 | 420ms latch + tip |
| Site interaction | 4.2 | Anchors + Work travel |
| Scroll choreography | 4.2 | Home strong; Work hops visible |
| Anti-gimmick | 4.5 | Quieter discovery |
| Idle / exit manners | 5 | 9s + returning cue |
| Home polish | 4.5 | Authored journey intact |
| Work polish | 4.2 | Travel poses registering |

**Average: 4.56** · First ≥4.5 pass. Need consecutive confirm (008).

## Must-fix
- [x] D-pad full session
- [x] Idle ≥8s
- [x] Keys preventDefault while playing
- [x] CTA overlap 0 (prior probe; re-check on 008)
- [x] `prefers-reduced-motion` disables
