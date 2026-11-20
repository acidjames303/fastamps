# Base44 prompt — Playground iteration 001 (first-run success)

Paste into the SmartFunction Base44 builder chat. Preview, then publish.

---

Improve **only** the public Playground workflow mapper (`/playground`).  
Do **not** add or change any stickman/character overlay. Do not redesign Home, Work, Services, or Smart Builder model logic. Keep templates, validation rules, free-analysis limits, and call/project form fields unless a copy/UI change below requires a small layout tweak.

## Goal
A first-time visitor should understand why they are mapping their process, be able to connect steps without hunting, reach analysis on mobile without scrolling forever, and never lose sight of the map they drew when the free-analysis email gate appears.

---

### A) Meta description (Playground page only)
Keep a clear title. Replace the boilerplate meta description (“premium digital agency platform…”):

- **Title:** `SmartFunction Playground — Map your process, then make it smarter`
- **Description:** `Draw how your business works as steps and connections. Get one free Smart Builder analysis — no account required — then turn it into a scoped SmartFunction project.`

### B) Hero — say why the map matters
Keep eyebrow `SmartFunction Playground`.  
Keep title: `Draw how your business works. Then make it smarter.`

**Replace intro with:**  
`Map the steps you actually use today — email, spreadsheets, calls, approvals. Smart Builder gives you one free plain-English proposal for a tighter process. If it looks useful, send it to SmartFunction and we’ll show how our apps, automation and services could run it.`

**Replace the four step labels with:**  
1. `1 · pick a familiar process`  
2. `2 · map the real steps`  
3. `3 · get one free analysis`  
4. `4 · talk solutions with us`

### C) Analysis band copy
Keep button label `Make it smarter`.

Replace eyebrow `One click, plain English` with: `Free Smart Builder analysis`

Replace supporting paragraph with:  
`We’ll read your steps and connections, flag manual work and duplicated data, and propose a clearer process — including where a person should still approve. That map is what we use to advise on the right SmartFunction build or automation.`

Keep fine print:  
`first analysis free · no account needed · no invented savings or guarantees`

### D) Teach connecting (copy + affordance)
1. Replace empty Step settings `//` tips with plain lines:
   - `Drag a step to move it`
   - `Drag the small circle from one step onto another to connect them`
   - `Click a connection line to remove it`
2. Make the connect circle on each step **visible by default** (or on first paint for a few seconds) so “circle to connect” is not a secret. Soft, on-brand — not arcade chrome.
3. Canvas hint can read: `Drag to arrange · drag the circle to connect · drag canvas to pan`

### E) Mobile — don’t bury analysis
On small screens (list mode):
1. Keep a short hero (title + one sentence) above the list — do not drop orientation entirely.
2. Replace clipped note with: `On phones you edit steps as a list. Connections stay in order; the visual map appears with your Smart Builder result.`
3. Add a **sticky bottom bar** with `Make it smarter` so the analysis CTA stays reachable while scrolling the list. Do not cover primary step fields; give safe-area padding.

### F) Email gate — keep the user’s map visible
When showing `Your free analysis has been used` / name+email to run another:
- Do **not** blank the canvas or hide the steps they mapped.
- Keep the step/connection counts visible.
- Gate copy can stay honest; optional tighten to:  
  `Your free analysis for this visit is used. Add your name and business email to run another — no account, and we’ll only contact you about this process.`

### G) Dual CTA clarity (light touch)
Nav button `Let's make it smarter` should scroll to the Playground analysis band (or the template picker if above the fold), not feel like a second broken analyze action. In-page button remains the one that runs Smart Builder.

---

## Out of scope
- New templates, new form fields earlier in the flow
- Stickman / character on this page
- Invented savings, ROI, urgency/scarcity gimmicks
- Admin Playground
- Changing Smart Builder model prompts beyond UI/copy above

## Acceptance
- Meta description is no longer agency boilerplate.
- Hero + analysis band state workflow → analysis → SmartFunction solutions.
- Connect circle is discoverable without reading `//` tips.
- Mobile: hero context + sticky `Make it smarter`.
- Email gate does not erase the mapped process from view.
- Free first analysis still works without an account when quota remains.
