# Iteration 002 — unlock direct apply path (2026-11-17, Europe/London)

## Live site
Still on `StickmanOverlay-DaYzQLaO.js` — manners gates unchanged.

## Progress toward end state
Cannot edit Base44 from prompts alone forever. This iteration wires the **apply** half of the loop:

1. Confirmed Base44 CLI supports `sandbox grep/edit/checkpoint` and headless auth via `BASE44_API_KEY` (`b44k_…`).
2. App id from live site: `6afb374c91d1c9194f9d6554`.
3. Added `scripts/apply-manners-via-sandbox.mjs` to patch `mt`/`ht`/`Ot`/`xt` then checkpoint.
4. Requested Cursor secrets `BASE44_API_KEY` + `BASE44_APP_ID` (and optional paste-NEXT_BASE44 external action).

## Still blocked
No API key in the VM yet → cannot sandbox-edit. Until secrets land **or** James pastes `prompts/NEXT_BASE44.md`, live stickman cannot improve.

## Next immediate step when unblocked
```bash
cd stickman-hillclimb
npm run apply:manners:dry
npm run apply:manners
# publish if required by Base44, then:
npm run playtest
```
Expect: `dpadPersists8s`, `idleStillPlayingAt3_5s`, `flyObserved` all true.
