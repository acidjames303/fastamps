# CI-028 — Pilot vs Cadence phone audit (26 Nov 2026, Europe/London)

## Files compared
- **Original:** `Copy of B2BSales - Pilot Data - 241126.xlsx` (1,634 contacts)
- **Cadence export:** `Copy-of-B2BSales-Pilot-Data-241126-26-11-2026-Contacts.csv` (2,071 rows)

## Verdict

**Import mobiles were not replaced.**  
**Additive Lusha second mobiles were not visible in this export** — schema/export gaps, not evidence that Lusha never returned extras.

| Check | Result |
|---|---|
| Matched people (name + company) | 1,586 / 1,634 |
| Original with mobile | 1,104 |
| Import mobile preserved (same digits) | **1,079** |
| Import mobile replaced by a different number | **0** |
| Import mobile missing in Cadence | **0** |
| Mobile filled where original was empty (likely Lusha add) | **24** matched (+ more unmatched) |
| Direct dials changed | **0** |
| Rows with `Phone Source = lusha` | 107 (28 matched empty-import; 79 unmatched extras) |
| Export columns `Import mobile` / `Lusha mobile` | **Absent** on this Contacts CSV |

## What this means
1. Primary numbers from the pilot sheet survived enrichment — good.
2. When Lusha found a mobile for someone with none, Cadence stored it (`phone_source: lusha`) — good.
3. When someone already had an import mobile, this export cannot prove a second Lusha number was kept — `lusha_mobile` was not a persisted schema field, and this CSV format has no Import/Lusha columns (unlike campaign export).
4. 290 preserved mobiles show `Phone Source = No recorded source` — provenance gap to tighten on re-enrich.

## Fixes shipped (before next enrich)
- Persist `lusha_mobile` / `lusha_phone_status` on Prospect + Contact schemas
- Recreate `ContactPhone` entity; write Lusha extras as candidates beside import numbers
- Prospecting **Phone audit CSV** (Import vs Lusha columns)
- Person cards show **Lusha mobile · …** when additive
- Re-enrich payload now passes `mobile`, `phone_source`, `lusha_mobile` so import stays protected

## How to re-try enrichment safely
1. Open the pilot list in **Find prospects**
2. Select people (or use per-row re-enrich) — selected re-enrich works on `complete` rows
3. After enrich, download **Phone audit CSV** and confirm `Has additive Lusha = Yes` where Lusha returned a different mobile
4. Prefer **Campaign → Export all CSV** for columns **Import mobile** · **Lusha mobile**
