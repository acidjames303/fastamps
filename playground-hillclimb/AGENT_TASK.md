# Playground Hillclimb — Agent Task

## Objective
Keep auditing and improving the SmartFunction **Playground** (`/playground`) until the flow is easy to use, clearly explained, and reliably collects useful customer workflow data that SmartFunction can turn into solutions and services.

Live site: https://smartfunction.io/playground  
Source of truth for shipping changes: **Base44** (paste the latest prompt from `prompts/NEXT_BASE44.md` each round into the Base44 builder chat).

## Product goal (do not drift)
Playground exists to:
1. Help a visitor **map how their business currently works** (steps + connections).
2. Run **one free Smart Builder analysis** (no account required).
3. Capture enough **workflow + contact context** that SmartFunction can reply with a scoped way to improve it (call or project enquiry).
4. Prefer honest, useful process data over vanity engagement.

## Loop (every iteration)
1. **Playtest** `/playground` with `scripts/playtest.mjs` and/or a browser agent (desktop + mobile).
2. **Score** against `RUBRIC.md` (1–5 per criterion). Record in `iterations/NNN.md`.
3. **Pick one lever** — the lowest-scoring criterion, or the biggest friction vs the product goal. Change only that lever.
4. **Write** a tight Base44 prompt into `prompts/NEXT_BASE44.md` (preserve what works; no whole-site redesign).
5. **Apply** (preferred order):
   1. If `BASE44_API_KEY` + `BASE44_APP_ID` are available: use Base44 sandbox edit (see `.env.example`). Dry-run first when possible.
   2. Else: James pastes `prompts/NEXT_BASE44.md` into the Base44 builder chat and publishes.
6. **Re-test** live after deploy. If score improves, lock the win in the iteration log. If not, revert the lever and try another.
7. **Repeat** until average rubric ≥ 4.5 across two consecutive iterations with no Must-fix failures.

## App identity
- Live app id (from site media paths): `6afb374c91d1c9194f9d6554`
- See `.env.example` for CLI env vars (`BASE44_API_KEY` starts with `b44k_`).

## Scope lock
- **In:** Playground page only — hero/copy, template picker, canvas/list mapping UX, validation messaging, Smart Builder CTA + free-analysis gate, before/after comparison clarity, call/project conversion copy, mobile list mode, meta title/description for `/playground`.
- **Out:** Stickman motion, Home/Work redesign, new site sections, Smart Builder model rewrite, inventing savings/guarantees, admin playground internals unless they block the public flow, SEO site-wide work (handled elsewhere).

## Definition of done (goal complete)
- A first-time visitor understands **what to do and why** within ~5 seconds.
- Mapping a template (or blank) to a valid connected process takes ≤2 minutes without hunting for controls.
- Free analysis value exchange is clear (workflow data → useful proposal; email only when needed).
- Call / project paths feel like natural next steps, not a hard sell.
- Rubric average ≥ 4.5 across two consecutive iterations with no Must-fix items remaining.
