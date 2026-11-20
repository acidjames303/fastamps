# Live stickman timing constants (verified 2026-11-17 · iter 004)

Source: `src/hooks/useStickmanJourney.js` (also minified into `_site-*.js` on smartfunction.io).

| Source const | Live value | Meaning |
|--------------|------------|---------|
| `PLAY_IDLE_MS` (`Fe`) | `9000` | Ground idle → exit play |
| `FLY_IDLE_MS` (`Le`) | `9000` | Fly idle → exit play |
| `RETURN_CUE_MS` (`Ie`) | `2000` | Show `returning…` before auto-exit |
| `DOUBLE_TAP_MS` (`X`) | `420` | Double-tap jump → bigJump / fly latch |
| `DANCE_TAP_MS` | `280` | Opposite-tap dance window |
| `DANCE_MS` | `1900` | Dance duration |
| `PLAY_FLY_SPEED` (`ze`) | `440` | Max air steer speed |
| `PLAY_FLY_GRAVITY` (`He`) | `620` | Gravity while flying (no thrust) |
| `PLAY_THRUST` | `1560` | Up held in fly (applied negative) |

Play HUD (not timed away): PLAYING chip + legend + D-pad for whole session.

## Fly latch (important for testers)
Double-tap jump within `DOUBLE_TAP_MS` sets `bigJump`. **On landing**, phase becomes `fly`. Holding ↑/Space then applies thrust.

## UI copy in build
- Grab: `pick me up`
- Try-me: `Try me · gamepad or double-click`
- Legend: `← → move · ↑ jump · ↑↑ fly · Esc exit`
- Jump tip: `Tap jump again to fly`
- Jump aria: `Jump, press twice to fly`
