# Iteration 001 — verifier hardening + surgical prompt (2026-11-17, Europe/London)

## Live site status
**Unchanged** vs baseline. James has not yet published a Base44 patch. Gate flags still fail on manners; fly now measurable.

## What we did this turn
1. Re-tested live Home/Work — same product behaviour.
2. Hardened `scripts/playtest.mjs` so double-tap→land→fly is exercised correctly (was mistimed).
3. Documented live constants in `CONSTANTS.md` (`Ot=7000`, `mt=3000`, `ht=2600`, `xt=270`).
4. Rewrote `prompts/NEXT_BASE44.md` as a **surgical** Base44 patch (exact constant targets).

## Fresh flags (`npm run playtest`)
```json
{
  "mountedHome": true,
  "mountedWork": true,
  "dpadPersists8s": false,
  "stillPlayingAtDpadCheck": true,
  "idleStillPlayingAt3_5s": false,
  "idleStillPlayingAt9s": false,
  "flyObserved": true
}
```

### Interpretation
- **Fly works** when double-tap window is hit (pose-fly observed).
- **D-pad still auto-hides** while `playing=true` after ~7s — confirms `Ot` bug.
- **Idle exit still ~3s** — confirms `mt` / `ht` too aggressive.
- Scroll choreography remains the strong part (do not over-touch).

## Rubric (unchanged product → same scores as 000)
Average ~3.3. Must-fix gates still open: D-pad persistence, idle ≥8s.

## Blocked on
Base44 publish of `prompts/NEXT_BASE44.md`. Until then, agents refine prompts/verifiers only — cannot change live stickman from this repo.

## Next
After Base44 publish: re-run playtest; expect `dpadPersists8s`, `idleStillPlayingAt3_5s`, `flyObserved` all true. Then open iteration 002 for micro feel only if gates pass.
