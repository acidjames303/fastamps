# Iteration 017 — Work journey fixes (2026-11-17, Europe/London)

Follow-up to [Work stickman bug hunt](bc-bafdc367-8782-5cb4-b6b6-4b5bed7a32b2).

## Bugs addressed
1. **Edge-walking** — removed per-card `slide` on `card.right`
2. **Text obscuring** — no mid-paragraph hang; aside stands at headline top margin
3. **CTA hover** — hold offset `left - W - 100`, higher clearance above button
4. **Teleport / clipped wave** — open on `work-intro` (not clipped page-hero)
5. **Arcing over copy** — later card landings use `run` instead of high `jump`

Checkpoints `6afcd454…` → `6afcd51a…` deployed.

## Still true
Stickman only on `/` + `/work` (iter 016).
