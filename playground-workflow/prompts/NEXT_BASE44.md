# Base44 prompt — Playground iteration 001 (paste this whole message)

You are editing the SmartFunction app. Change **only** the public `/playground` workflow mapper (Smart Builder UI).  
Do **not** add a stickman/character. Do not redesign other pages. Do not change the Smart Builder model/prompt logic, free-analysis quota rules, templates list, or call/project form fields.

Publish after preview.

## Must change (exact strings)

### 1. SEO meta for Playground page
- Title → `SmartFunction Playground — Map your process, then make it smarter`
- Description → `Draw how your business works as steps and connections. Get one free Smart Builder analysis — no account required — then turn it into a scoped SmartFunction project.`
- Remove description text containing `premium digital agency platform`

### 2. Hero
Keep title: `Draw how your business works. Then make it smarter.`

Replace intro with exactly:  
`Map the steps you actually use today — email, spreadsheets, calls, approvals. Smart Builder gives you one free plain-English proposal for a tighter process. If it looks useful, send it to SmartFunction and we’ll show how our apps, automation and services could run it.`

Replace step strip with exactly:  
`1 · pick a familiar process` · `2 · map the real steps` · `3 · get one free analysis` · `4 · talk solutions with us`

### 3. Analysis card
- Eyebrow → `Free Smart Builder analysis` (replace `One click, plain English`)
- Body → `We’ll read your steps and connections, flag manual work and duplicated data, and propose a clearer process — including where a person should still approve. That map is what we use to advise on the right SmartFunction build or automation.`
- Keep button label `Make it smarter`
- Keep: `first analysis free · no account needed · no invented savings or guarantees`

### 4. Connect teaching
- Delete developer tips that start with `//`
- Empty step-settings tips →  
  `Drag a step to move it`  
  `Drag the small circle from one step onto another to connect them`  
  `Click a connection line to remove it`
- Canvas hint → `Drag to arrange · drag the circle to connect · drag canvas to pan`
- Make each step’s connect circle visible by default (subtle, always-on or visible until first successful connection). Visitors should not need hover to discover connecting.

### 5. Mobile list mode
- Keep a short hero (title + intro) above the list
- List note → `On phones you edit steps as a list. Connections stay in order; the visual map appears with your Smart Builder result.`
- Add a sticky bottom bar with primary button `Make it smarter` (safe-area padding). It must stay visible while scrolling steps.

### 6. Free-analysis email gate
When showing `Your free analysis has been used` + name/email fields:
- **Keep the user’s mapped steps visible** (do not blank/unmount the canvas or list)
- Keep step/connection counts visible
- Gate body may use: `Your free analysis for this visit is used. Add your name and business email to run another — no account, and we’ll only contact you about this process.`

### 7. Header CTA
`Let's make it smarter` in the site header should smooth-scroll to the Playground analysis card (`Make it smarter` band), not navigate away or no-op.

## Done when
- Meta description is not the agency boilerplate
- Hero mentions SmartFunction apps/automation/services as the outcome
- No `//` tips remain on Playground
- Connect circles are visible without hover
- Mobile shows sticky `Make it smarter`
- Email gate does not hide the mapped process
