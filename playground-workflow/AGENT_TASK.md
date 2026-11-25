# Playground workflow agent — task

## Objective
Improve the SmartFunction **Playground** app at `/playground` so clients can map how their business works today, run one free Smart Builder analysis, and hand that workflow to SmartFunction for solutions and services.

Live: https://smartfunction.io/playground  
Ship changes via **Base44** — paste `prompts/NEXT_BASE44.md` into the Base44 builder chat each round (or apply via API when secrets exist).

## Product goal (do not drift)
1. Help a visitor **map their real workflow** (steps + connections).
2. Run **one free Smart Builder analysis** (no account).
3. Capture enough **workflow + contact context** for a call or project enquiry.
4. Prefer useful process data over vanity engagement.

## Loop (every iteration)
1. Playtest `/playground` (`scripts/playtest.mjs` and/or browser).
2. Score with `RUBRIC.md`. Log in `iterations/NNN.md`.
3. Pick **one** lever (lowest score or biggest friction vs the product goal).
4. Write `prompts/NEXT_BASE44.md`.
5. Apply in Base44 → publish → re-test → lock wins or revert.

## App identity
- App id: `6afb374c91d1c9194f9d6554`
- See `.env.example` for optional `BASE44_API_KEY`

## Scope lock
- **In:** Playground only — hero/copy, templates, canvas/list mapping UX, validation, Smart Builder CTA + free analysis, before/after clarity, call/project conversion, mobile list mode, `/playground` meta.
- **Out:** Stickman (any page), Home/Work redesign, new site sections, Smart Builder model rewrite, invented savings/guarantees, Admin Playground unless it blocks the public flow, site-wide SEO.

## Done when
- First-time visitor understands what to do and why within ~5 seconds.
- Mapping a template (or blank) to a valid connected process takes ≤2 minutes.
- Free analysis value exchange is clear.
- Call / project paths feel like natural next steps.
- Rubric average ≥ 4.5 on two consecutive iterations with no Must-fix failures.
