# Iteration 005 — Work run hops + CTA clearance (2026-11-17, Europe/London)

## Lever
One change only vs 004 manners lock:
1. Work image cross: `walk` → **`run`**
2. CTA hold offset Home + Work: `left - W - 10` → **`left - W - 56`**

Checkpoint `6afca017b29876cb7a7d8e04` · deployed 18:42 UTC · live `_site-CAP9HwHh.js` confirms `r.left-a-56` / `move:\`run\``.

## Automated flags
All manners gates still green:
`dpadPersists8s`, `idleStillPlayingAt3_5s`, `flyObserved` = true.

## CTA must-fix
Playwright overlap probe at page bottom: **0 px** overlap with “Start a conversation” / “Let's make it smarter” on `/` and `/work`.

## Work tour poses (still mixed)
| scrollY | pose |
|--------:|------|
| 0 | wave |
| 706 | slide |
| 1412–2824 | idle ← still under-expressed |
| 3530+ | hold |

Run hops are in the path, but discrete scroll samples still catch him in gait-idle while the damped chase catches up. Next lever should target **pursuit speed / pose hold on Work**, not more stops.

## Rubric delta vs 004
| Criterion | 004 | 005 |
|-----------|----:|----:|
| Work polish | 3.5 | 3.8 |
| Anti-gimmick / CTA | 4 | 4.5 (clearance proven) |
| Others | unchanged | unchanged |

**Average ~4.3** — still shy of 4.5×2.

## Next lever (006)
Raise Work chase responsiveness only while on `[data-sm-work-page]` (slightly lower HALF_LIFE or force travel pose when |sample−motion| gap is large) so mid-card samples read as run/jump/hang instead of idle — without speeding Home.
