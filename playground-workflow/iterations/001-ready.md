# Iteration 001 — ready to paste (first-run success)

**Date:** 20 Nov 2026 (Europe/London)  
**Prompt:** `prompts/NEXT_BASE44.md`  
**Status:** Waiting for Base44 apply (paste into builder chat, or API when available)

## New live evidence (this round)

| Finding | Severity | Notes |
|---------|----------|-------|
| Smart Builder analysis **works** (~2–4s) | — | `_serverFn` returns `ok` + analysis; before/after walkthrough renders |
| Free analysis is **visit/fingerprint limited** | Expected | When limited: email gate shows (“Your free analysis has been used…”) |
| Email gate can appear with **empty-looking canvas** | High | Mapped steps should stay visible while asking for name/email |
| Mobile CTA at ~y=2129 | High | Hero present; `Make it smarter` buried — needs sticky bar |
| Connect teaching still weak | High | `//` tips + low-contrast “circle to connect” |
| After-analysis UX is strong | Good | Before/after toggle, walkthrough, “conceptual proposal — not a quotation”, plain-English panel |
| [Audit Playground UX live](bc-d9d8a539-4481-5f1f-974b-6b6e2298e483) “CTA broken / settings empty” | False positive | Re-tested: CTA analyses; step settings populate on click |

## Lever shipped in this prompt (one cohesive first-run package)
Orientation + value exchange + connect discoverability + mobile sticky CTA + keep map visible on email gate + meta description + light nav CTA scroll behaviour.

## After James publishes
1. Re-run `npm run playtest`
2. Score `RUBRIC.md` → write `iterations/002-remeasure.md`
3. Next lever if still open: default zoom/fit, template strip height, conversion microcopy polish
