# Stickman Hillclimb — Agent Task

## Objective
Keep auditing and improving the SmartFunction stickman on **Home (`/`) and Work (`/work`) only** until he feels smooth, flawless, and dynamically part of the site — not a gimmick.

Live site: https://smartfunction.io  
Source of truth for shipping changes: **Base44** (paste the latest prompt from `prompts/NEXT_BASE44.md` each round).

## Loop (every iteration)
1. **Playtest** Home + Work with `scripts/playtest.mjs` and/or a browser agent.
2. **Score** against `RUBRIC.md` (1–5 per criterion). Record in `iterations/NNN.md`.
3. **Pick one lever** — the lowest-scoring criterion, or the biggest “gimmick vs craft” gap. Change only that lever.
4. **Write** a tight Base44 prompt into `prompts/NEXT_BASE44.md` (preserve what works; no site redesign).
5. **Apply** (preferred order):
   1. If `BASE44_API_KEY` + `BASE44_APP_ID` are available: `npm run apply:manners` (sandbox edit + checkpoint). Dry-run first with `npm run apply:manners:dry`.
   2. Else: James pastes `prompts/NEXT_BASE44.md` into the Base44 builder and publishes.
6. **Re-test** live after deploy. If score improves, lock the win in the iteration log. If not, revert the lever and try another.
7. **Repeat** until average rubric ≥ 4.5 and no Must-fix items remain.

## App identity
- Live app id (from site media paths): `6afb374c91d1c9194f9d6554`
- See `.env.example` for CLI env vars (`BASE44_API_KEY` starts with `b44k_`).

## Scope lock
- **In:** Home + Work stickman motion, discovery, physics feel, scroll choreography, panel landings, play-mode UX, brand-fit microcopy.
- **Out:** New pages, Smart Builder rebuild, new game modes, scores/leaderboards, sound-on-by-default, purple/glow redesigns.

## Controls reference (do not break)
- Enter play: bottom-left gamepad **or** double-click stickman
- Move: ←→ / A D · Jump: Space / ↑ / W · Fly: double-tap jump, hold ↑ for thrust · Esc exit
- Mouse: pick up, toss, tickle · Scroll tour uses `data-sm-anchor` stops

## Definition of done (goal complete)
- Home + Work feel intentional: he reacts to sections without stealing attention from CTAs
- Play mode is discoverable in ≤5s without feeling like an arcade widget
- Walk / jump / fly / land / toss are smooth; idle exit is patient; D-pad stays while playing
- Rubric average ≥ 4.5 across two consecutive iterations with no regressions
