# Stickman — optional polish (post 4.5×2 lock)

Live Home/Work already meet the hillclimb done criteria. Only apply if a real regression appears or James wants easier play entry.

## Optional single lever
In `PlayControls.jsx`, enlarge the gamepad (+ pause) hit targets from `h-7 w-7` to **`h-9 w-9`**, and the in-play D-pad buttons from `h-7 w-7` to **`h-8 w-8`**. Keep electric border when playing. No new chrome, scores, or pages.

## Do not change
Manners timings, CTA clearance, Work chase/pose hold, scroll-gated Try-me.

## Verify
```bash
cd stickman-hillclimb && npm run playtest
```
Expect manners flags true, `workTravelPoses ≥ 5`.
