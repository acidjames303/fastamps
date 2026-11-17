# Iteration 006 — Work pursuit + travel pose hold (2026-11-17, Europe/London)

## Lever
In `useStickmanJourney.js` (Work `/work` only):
- Snappier chase: `WORK_HALF_LIFE=118`, fall/climb 90/150
- Keep authored `run` (no gait→idle collapse)
- Force sample travel poses (`run`/`jump`/`style-jump`/`land`/`slide`/`hang`→`swing`/`climb`) while on Work

Checkpoints: `6afca168…` → `6afca221…` (006b) deployed.

## Playtest
Manners gates still green. Harness densified on Work.

```json
{
  "dpadPersists8s": true,
  "idleStillPlayingAt3_5s": true,
  "flyObserved": true,
  "workTravelPoses": 6,
  "workTravelVariety": 3
}
```

Dense Work tour now catches `slide` / `style-jump` / `walk` mid-page (coarse 7-point sampling previously looked all-idle).

## Rubric
| Criterion | 005 | 006 |
|-----------|----:|----:|
| Work polish | 3.8 | 4.2 |
| Site interaction | 4 | 4.2 |
| Scroll choreography | 4 | 4.2 |
| Others | ~same | ~same |

**Average ~4.4** — approaching 4.5; need one more clean polish + a confirming re-score.

## Next lever (007)
Soft anti-gimmick: slightly quieter PLAYING chip / try-me timing after first scroll stop only — or founder/CTA hold polish on Home if Work holds at 4.2 on a second consecutive pass.
