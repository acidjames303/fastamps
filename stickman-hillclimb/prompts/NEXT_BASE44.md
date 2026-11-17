# Paste into Base44 — Iteration 001 (surgical Home + Work polish)

You are editing the SmartFunction stickman overlay (StickmanOverlay / `sm-figure`) on **Home `/` and Work `/work` only**. Do not redesign the marketing site. Do not add him to other pages this round.

Brand stays: Space Grotesk, IBM Plex Mono, electric blue, `#F7F7F5`, quiet B2B tone. Keep `prefers-reduced-motion` disabling the character.

## Exact behaviour patches (do these)
In the stickman play controller constants / logic:

1. **D-pad persistence:** Today the play D-pad + hint hide after ~`7000ms` (`Ot`). Remove that auto-hide while `playing` is true. D-pad (Step left / Jump / Step right) must remain for the whole play session. Keep the first hint text, but also keep a compact legend visible while playing: `← → move · ↑ jump · ↑↑ fly · Esc exit`.

2. **Patient idle exit:** Ground idle timeout is ~`3000ms` (`mt`) and fly idle ~`2600ms` (`ht`). Change both to **`9000`**. Two seconds before auto-exit, show a tiny mono `returning…` near the character, then hand back to scroll tour.

3. **Reliable fly latch:** Double-tap jump window is ~`270ms` (`xt`) — too tight. Raise to **`420ms`**. Keep the existing model: double-tap sets bigJump; landing enters `fly`; hold ↑/Space for thrust. First successful double-tap in a session may flash once: `Tap jump again to fly`.

4. **Discoverability (quiet):** After the first scroll stop on Home and Work, show a mono `Try me` near him for ~4s, then fade. Enlarge the bottom-left gamepad hit target slightly; when playing, electric border + mono `PLAYING` chip.

5. **Play scroll lock:** While playing, `preventDefault` on Space/arrows/WASD and do not let scroll-driven tour reposition him until exit.

6. **Toss keeps play:** If he was in play mode, after a toss settles remain in play (don’t immediately dump to tour).

7. **Fly readability:** In play/fly, slight scale-up + keep ground shadow + short motion trails only in `pose-fly`.

## Preserve (do not blunt)
- Hero stance on SYSTEM_MAP.DIAGRAM frame
- Human-flow / services / builder / work-visual / process-track stops
- Jump arc between approach stage nodes
- Founder parachute + standing on “friction”
- Divider/text perches; non-blocking size; CTAs always clickable
- Pause control + Escape exit + double-click to enter play

## Do not add
New pages, scores, coins, sound-on-by-default, neon glow, emoji, second character, leaderboards.

## Acceptance (agents will re-test)
After publish, `stickman-hillclimb` playtest on `/` + `/work` must report:
- `dpadPersists8s: true`
- `idleStillPlayingAt3_5s: true`
- `idleStillPlayingAt9s: false` (exits by ~9–11s is OK)
- `flyObserved: true`
- Still mounted on Home and Work only for this round
