# Lusha mobile enrichment audit

**Date:** 25 Nov 2026 (Europe/London)  
**Live:** https://cadence.smartfunction.io  

## What you were seeing

Multiple correct people with emails, but mobiles only landing on one person (sometimes two numbers that both belong to that lead / account).

Live samples match that pattern: companies with 2+ contact emails commonly have a mobile on the lead only, or none via API.

## Root causes (ordered)

### 1. Product behaviour stopped after the first mobile (main bug)

“Check other known contacts” / mobile widen only ran when **nobody** on the account had a mobile yet. As soon as person 1 got a number, person 2 and 3 were never asked.

Many live sessions also ran with `search_depth: standard` + `single_best_contact: true` (only one person sent to Lusha), while `widen_mobile_search: true` — widen then did nothing once that one mobile arrived.

### 2. Emails are easier than mobiles

Emails come from Apollo discovery + free pattern inference across several people. Mobiles need a paid Lusha phone reveal per person, UK `07` validation, and a **confirmed current employer**. Landlines / unconfirmed matches go to direct-dial or review — not “mobile”.

Lusha attempt mix in recent data: successful / not_found / skipped roughly even; fields returned show many `personal_email` + `mobile`, few `direct_dial`.

### 3. “Mobile found” was too loose

`getMissingFields('mobile')` treated any `prospect.phone` as done — including non-mobiles — so re-runs would not chase real mobiles for the rest of the team.

### 4. Not always “Lusha holding it back”

When Lusha returns `matched_no_number` / `contact_not_matched` / plan-restricted partial profiles, Cadence cannot invent a mobile. That is provider coverage, not a silent drop.

## Fix shipped in code (needs redeploy)

1. Widen continues for other known people **even after** the first mobile succeeds.  
2. `mobile` missing-check requires a real UK mobile.  
3. Coverage copy updated to match the real behaviour.  
4. Provenance no longer stores `provider_value: [object Object]`.

## How to run it for every person

In the enrich dialog:

- Search method: **Connected providers** (Lusha)  
- Depth: **Expanded** or **Exhaustive** (not Standard)  
- Phone coverage: leave **Also find mobiles for other already-known contacts** on  

Expect more Lusha credits when several people already have emails.
