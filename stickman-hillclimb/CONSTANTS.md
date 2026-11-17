# Live StickmanOverlay timing constants (verified 2026-11-17)

From `StickmanOverlay-*.js` on smartfunction.io. Use these when writing Base44 patches.

| Symbol | Live value | Meaning | Target for polish |
|--------|------------|---------|-------------------|
| `Ot` | `7000` | D-pad + play hint auto-hide while playing | Keep visible entire play session (`Infinity` / no timeout) |
| `mt` | `3000` | Ground idle → exit play (ms) | `9000` |
| `ht` | `2600` | Fly idle → exit play (ms) | `9000` |
| `xt` | `270` | Double-tap jump window for bigJump/fly latch (ms) | `420` |
| `St` | `260` | Opposite-tap dance window | keep |
| `Ct` | `1600` | Dance duration | keep |
| `_t` | `440` | Max air steer speed | keep / slight ↑ if fly feels sluggish |
| `bt` | `620` | Gravity while flying (no thrust) | keep |
| thrust | `-1560` | Up held in fly | keep |

## Fly latch (important for testers)
Double-tap jump within `xt` ms sets `bigJump`. **On landing**, phase becomes `fly`. Holding ↑/Space then applies thrust. It is not “second jump mid-air always equals fly” unless already airborne and rising inside the window.

## UI copy already in build
- Grab: `pick me up`
- Play hint: `← → move · ↑ twice to fly`
- Jump button aria: `Jump, double tap to fly`
