# Playground quality rubric

Score each criterion **1–5**. Target: average ≥ **4.5** on two consecutive iterations.

| # | Criterion | 1 | 3 | 5 |
|---|-----------|---|---|---|
| 1 | **Orientation** | Unclear what page is for | Hero ok; next action fuzzy | ≤5s: map process → free analysis → optional project is obvious |
| 2 | **Template start** | Templates opaque / blank only | Templates exist; little guidance | Templates read as real workflows; picking one feels like a head start |
| 3 | **Mapping ease** | Controls hidden / fight the user | Drag works if you explore | Arrange + connect + edit without hunting; canvas + list both usable |
| 4 | **Connection clarity** | Edges mysterious | Hint exists; still missable | Connect affordance obvious; list of edges editable; empty-state teaches |
| 5 | **Validation empathy** | Cryptic / blamey errors | Accurate but cold | Errors name the fix; notes (orphans) teach without blocking harshly |
| 6 | **Analysis CTA** | Buried or scary | Visible; trade-off vague | “Make it smarter” clear; free / no-account / no fake guarantees visible |
| 7 | **Email / privacy gate** | Feels like a trap | Gate works; copy thin | Why email now is explicit; privacy ack readable; second-run gate fair |
| 8 | **Before / after clarity** | Diff unreadable | Comparison present | Visitor can tell what changed and what stayed human |
| 9 | **Conversion honesty** | Hard sell / empty form | Call vs project exists | Both paths explain what is sent; no false commitment; next steps clear |
| 10 | **Mobile flow** | Broken / unusable | List mode works | Mobile path collects equal-quality workflow data without canvas despair |

## Must-fix gates (any fail = not done)
- [ ] Visitor can complete template → connected map → analysis CTA without reading developer-style tips only
- [ ] Free first analysis remains available without creating an account
- [ ] No invented savings, ROI, or delivery guarantees in Playground copy
- [ ] Call / project submit states what SmartFunction will do next (human review, reply window)
- [ ] Mobile can add ≥3 named, connected steps and reach the analysis CTA
- [ ] `/playground` meta title/description are Playground-specific (not Base44 boilerplate)

## Anti-patterns (do not ship)
- Purple/glow redesigns, emoji stickers, or arcade chrome on a discovery tool
- Collecting phone/budget/marketing consent *before* the visitor has mapped a process
- Rewriting Smart Builder model behaviour as a UI “fix”
- Expanding Admin Playground or new site pages before the public flow scores ≥ 4.5
- “More templates” when the real problem is connect discoverability or CTA copy
