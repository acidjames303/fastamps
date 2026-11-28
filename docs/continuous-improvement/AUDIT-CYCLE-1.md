# Audit notes — CI cycle 1 (25 Nov 2026, Europe/London)

Compared source + prior authenticated inventory against the Continuous Improvement PDF. Live click-through of every role was not completed in this cycle (Builder publish / test-session auth still required for production UI evidence). Code-level findings:

## Verified in code

| Area | Finding | Pri |
|---|---|---|
| Dialer brief | CompanyIntelligence only until this cycle; AccountResearch not live | P1 → fixed |
| Call-ready | Needs verified/manually_confirmed; Confirm checkmark did not promote readiness | P1 → fixed |
| Nav IA | Today · Campaigns · Prospecting · Calling · Outreach · Inbox · Team — matches brief | OK |
| Research entity | AccountResearch with evidence + source_url — good model | OK |
| FullEnrich | Phones-only / capped (prior PR #17) | OK |
| Push path | Copies research into CompanyIntelligence once — loses URLs | Mitigated by live load |
| Team / Inbox / lead sheets | Present; metric accuracy & prefills still need live verification | P2 |
| Multi-file campaign ingest | Guided builder exists; multi-worksheet NL fusion incomplete vs PDF §4 | P1 backlog |
| Secrets / data | No destructive changes in this cycle | OK |

## Highest-impact safe improvement selected

**CI-001 + CI-002** (research on Dialer + Confirm for calling) — commercial impact on Oxi-Tech-class lists and caller brief quality, no schema/secrets/auth risk.

## Live verification still required

- Dialer with a researched company shows Prospecting research + source links.
- Prospecting Confirm for calling flips phone_status and readiness badges.
- Capture screenshots with authorised test accounts (no live enrichment spend).
