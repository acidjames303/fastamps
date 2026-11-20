# Iteration 004 — manners live on production (2026-11-17, Europe/London)

## What shipped
Base44 device login approved → sandbox patched timing/UX → checkpoint `6afc9e14e120975b54a9aa77` → `POST /api/apps/.../deploy` at 18:35 UTC → verified on https://smartfunction.io.

Live bundle now inlines stickman into `_site-DvnBXxA3.js` (no separate `StickmanOverlay-DaYzQLaO.js`). Minified consts: `Fe=9e3` / `Le=9e3` / `X=420` / `Ie=2e3`.

## Automated flags (`npm run playtest`)
```json
{
  "mountedHome": true,
  "mountedWork": true,
  "dpadPersists8s": true,
  "stillPlayingAtDpadCheck": true,
  "idleStillPlayingAt3_5s": true,
  "idleStillPlayingAt9s": false,
  "flyObserved": true
}
```

## Must-fix gates
- [x] D-pad remains visible for entire play session
- [x] Idle exit ≥ 8s on ground with no input (still playing at 3.5s; exited by ~9s)
- [x] Space/arrows preventDefault while playing (source confirmed)
- [ ] Character never blocks primary CTAs — **watch**: tour/play still parks beside `cta-action`
- [x] `prefers-reduced-motion` still disables him

## Rubric scores (1–5)

| Criterion | Score | Note |
|-----------|------:|------|
| Discoverability | 4 | `Try me · gamepad or double-click` + electric gamepad |
| Play-mode clarity | 5 | PLAYING chip + legend + persistent D-pad |
| Motion smoothness | 4 | Walk/jump/fly continuous in harness |
| Fly feel | 4.5 | 420ms latch; tip cue; thrust readable |
| Site interaction | 4 | Home anchors strong; Work mid-scroll often idle |
| Scroll choreography | 4 | Home authored; Work card hops under-read |
| Anti-gimmick | 4 | Quiet mono HUD; still a touch “game chip” |
| Idle / exit manners | 5 | 9s idle + `returning…` cue |
| Home polish | 4.5 | Hero → flow → founder → CTA intact |
| Work polish | 3.5 | Mounted; land/walk/hang under-expressed mid-page |

**Average: ~4.25** · Need ≥4.5 twice. One consecutive high score not yet locked.

## Next lever (005)
**Work expressiveness + CTA clearance** — not new features.
1. Work card hops: prefer `run` / keep `land`→`walk`→`hang` readable (less gait→idle).
2. Offset CTA hold further from button hit-box on Home + Work.
3. Keep manners constants unchanged.
