# Paste into Base44 — Iteration 001 (Home + Work polish)

Improve the SmartFunction stickman on **Home (`/`) and Work (`/work`) only**. Do not redesign the site. Do not expand him to other pages yet. He is already strong — make him feel smoother, more intentional, and less like a hidden mini-game.

Keep brand: Space Grotesk + IBM Plex Mono, electric blue, stone `#F7F7F5`, founder-led UK B2B tone. Keep `prefers-reduced-motion` disabling him.

## Preserve (do not break)
- Scroll choreography via `data-sm-anchor` on Home and Work (wave, walk, run, slide, swing, hang, parachute, land, press, hold, read, tap).
- Play mode: gamepad button OR double-click stickman.
- Keys: ←→ / A D move; Space / ↑ / W jump; double-tap jump → fly; hold ↑ thrust; Esc exit.
- Mouse: pick me up, grab, toss, tickle; panel landings; wall-slide; soft return to scroll tour.

## This round — one theme: manners + discovery
1. **First-visit hint (Home + Work):** After he reaches the first scroll stop, show a quiet mono label near him for ~4s: `Try me` — then fade. No badges, no emoji, no arcade frame.
2. **Keep D-pad while playing:** Left / Jump / Right stay visible for the entire play session (especially touch). Do not auto-hide after 7s.
3. **Patient idle:** Raise ground idle auto-exit from ~3s to **9s**. 2s before exit, show tiny `returning…` then soft handoff back to scroll tour.
4. **Play legend while active:** Compact line while playing: `← → move · ↑ jump · ↑↑ fly · Esc exit`. Keep it until Esc/idle exit.
5. **PLAYING state:** When play mode is on, gamepad control uses electric border/fill and a mono `PLAYING` chip so pause vs play is obvious.
6. **Fly readability:** Slightly larger scale in play/fly; keep ground shadow; subtle motion trails in `pose-fly` only. Widen double-tap jump window a little; first fly attempt shows one tip: `Tap jump again to fly`.
7. **Home interaction polish:** Tighten scroll stops so he clearly uses hero-map → human-flow → services-preview → builder-flow → work-visual → process-track → founder parachute → cta-action. Landings should pulse the panel he touches (existing pulse OK). Never cover the primary CTA hit target.
8. **Work interaction polish:** On `/work`, keep card landings / image walks / heading hangs / CTA hold. Smoother transitions between work-card stops; no teleport pops.
9. **Scroll lock in play:** While playing, prevent Space/arrows from scrolling the page; ignore scroll-driven reposition until exit.
10. **Toss:** After a toss settles, stay in play mode if he was playing (don’t dump to tour immediately).

## Preserve these authored moments (do not blunt them)
- Hero stance on the SYSTEM_MAP.DIAGRAM frame
- Standing on “THE WORK THAT MATTERS” / human-flow landings
- Jump arc between approach stage nodes (the money shot)
- Standing on the word “friction” in the founder section
- Using divider lines and text glyphs as perches
- Non-blocking size; never cover primary CTAs

## Do not add this round
- New pages, collectible scores, sound-on, neon glow, speech balloons, leaderboards, extra characters
- Don’t over-animate idle into a distraction — subtle only

## Acceptance
- Discover play mode on Home within 5 seconds.
- Walk, jump, fly, steer, land on a card, toss, Esc — all smooth.
- D-pad still there after 20+ seconds of play.
- Idle exit feels patient (~9s) with a soft returning cue.
- Home and Work choreography feels authored; CTAs remain clickable.
- Feels like craft, not a gimmick.
- Re-run `stickman-hillclimb` playtest: flags `dpadPersists8s=true`, `idleStillPlayingAt3_5s=true`, `flyObserved=true`.
