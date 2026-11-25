# Cadence architecture map (living)

**Updated:** 25 Nov 2026 (Europe/London)  
**App:** https://cadence.smartfunction.io · Base44 app id via env / project config  
**Code:** `cadence-sales/`

## Core principle

**Research once, use everywhere.** Prospecting enrichment and AccountResearch must feed Dialer briefs, Outreach, campaign management, lead sheets and reporting — without duplicate databases.

## Primary workflows

| Workflow | Entry | Key entities | Key UI |
|---|---|---|---|
| Campaign setup | Campaigns / guided builder | Campaign, ProspectList | Campaign hub, builder |
| Prospecting & enrich | Prospecting | Prospect, ContactPhone, Enrichment*, AccountResearch | ProspectTable, SelectiveEnrich, Research |
| Push to calling | Prospecting → target list | Company, Contact, TargetListMember, CompanyIntelligence | pushProspectsToTargetList |
| Calling | Dialer / Today | CallLog, Contact, CompanyIntelligence, AccountResearch | BriefPanel, OutcomePanel |
| Outreach | Outreach | OutreachDraft/Lead/Template | Outreach workspace |
| Manager actions | Admin Inbox | Information requests, lead sheets, ReviewItem | ManagerInbox |
| Team | Team | UserProfile, CallLog, assignments | Team member detail |
| Reporting | Results | CallLog, Opportunity, AccountResearch | Results / client report |

## Research data path (current)

```
Prospecting AccountResearch (prospect_id, findings, source_url, evidence)
        │
        ├─ at push → CompanyIntelligence.ai_summary (flattened; URLs often lost)
        │
        └─ Dialer BriefPanel ← CompanyIntelligence (+ now live AccountResearch by company name)
```

Gap closed in CI cycle 1: Dialer also loads live `AccountResearch` so dig-deeper / post-push research remains visible with source URLs and evidence tags.

## Enrichment waterfall (authorised)

- **Lusha** — primary people/phone/email (unlimited plan; prefer before spending limited providers).
- **Apollo** — roles / company intel where configured.
- **FullEnrich** — **phones only**, capped (`FULLENRICH_MAX_PER_COMPANY`), only when mobile still missing.
- Never overwrite `verified` / `manually_confirmed` phones with unverified provider returns.
- Call-ready requires verified or manually confirmed phone status (see `campaignDataset`).

## Roles (app_role)

platform_owner · organisation_admin · sales_manager · internal_bd · bdm · reporting_user

## Deploy note

Base44 Builder / sandbox is the runtime source of truth when GitHub sync is disconnected. Git PRs remain the change history for agents; production publish is via Builder after gates.
