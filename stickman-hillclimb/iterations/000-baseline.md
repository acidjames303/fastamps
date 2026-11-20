# Iteration 000 — baseline (2026-11-17, Europe/London)

## Method
Instrumented Playwright playtest + StickmanOverlay source review on live https://smartfunction.io.

## Scope
Home `/` and Work `/work` only.

## Rubric scores (1–5)

| Criterion | Score | Note |
|-----------|------:|------|
| Discoverability | 2 | Tiny gamepad; no first-visit “try me” |
| Play-mode clarity | 2 | Hint brief; D-pad hides ~7s while still playing |
| Motion smoothness | 4 | Physics already strong |
| Fly feel | 3.5 | Works; double-tap window a bit tight; sprite tiny at ceiling |
| Site interaction | 4 | Good Home anchors; Work card landings present |
| Scroll choreography | 4 | Authored stops (hero → flow → founder chute → CTA) |
| Anti-gimmick | 3.5 | Brand-fit character; play mode can feel like a hidden mini-game |
| Idle / exit manners | 2 | ~3s ground idle kicks out; Esc OK |
| Home polish | 4 | Journey exists; discovery undercuts it |
| Work polish | 3.5 | Mounted + anchors; less “finished” than Home |

**Average: ~3.3** · Must-fix gates: D-pad persistence FAIL · Idle ≥8s FAIL

## Verified moves
Pass: gamepad enter, walk, jump, Escape  
Fail/weak: D-pad persistence, patient idle, first-visit discoverability, reliable double-jump→fly timing

## Automated flags (`npm run playtest`)
```json
{
  "mountedHome": true,
  "mountedWork": true,
  "dpadPersists8s": false,
  "idleStillPlayingAt3_5s": false,
  "idleStillPlayingAt9s": false,
  "flyObserved": false
}
```
By ~8s into play he had already auto-exited (`playing=false`). Double-jump fly did not latch in the automated run (`pose-idle` after ↑↑) — timing window is too tight.

## Feel pass (scroll tour)
Choreography on Home is already excellent (preserve hero frame, stage jump arc, “friction” perch). Play-mode entry can be flaky in some browser agents; trust Playwright for play-mode gates.

## Next lever (iteration 001)
**Play manners + discovery + reliable fly latch** — not new powers. Persistent D-pad, longer idle, clearer try-me, PLAYING chip, wider double-tap fly window — without arcade chrome.
