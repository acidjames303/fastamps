# Cadence authenticated inventory

**Date:** 24 Nov 2026 (Europe/London)  
**App:** https://evasive-dial-flow-go.base44.app · `6a7338f6106b1962aa31c00a`  
**Access:** Base44 CLI device login succeeded as app owner/collaborator  
**Local tree:** `cadence-sales/` (eject)

## Product confirmation

This **is** the sales OS described in the master brief — not CommDecide.

| Signal | Value |
|---|---|
| Name | Cadence |
| Slug | evasive-dial-flow-go |
| Main page | **Today** |
| Roles | platform_owner, organisation_admin, sales_manager, internal_bd, bdm, reporting_user |

## Pages (selected)

Today, Dialer, Campaigns (hub + prospect/import tabs), Contacts, Results, Outreach, ManagerInbox, Team, Settings, OrganisationAdmin, Pilot/SaaS ops pages, Compliance, Integrations, …

## Entities (selected)

Organisation, Campaign, Contact, Company, Prospect, ProspectList, CallLog, OutreachDraft/Lead/Template/Workspace, Enrichment*, Task, Meeting, Opportunity, …

## Backend functions (selected)

getTodayWork, prepareCallingSession, completeCallOutcome, twilio*, discoverCompanies, researchCompanies, findDecisionMakers, startProspectingRun, getManagerInbox, manageOutreach*, pushCampaignToCaller, …

## Note on eject

`base44 eject` also provisioned a **sandbox copy** app (`cadence-copy-0d150b85` / id `6b05fe60…`). Production remains `evasive-dial-flow-go`. Do not confuse the two when deploying.

## Phase 1 started

See [PHASE1-CHANGES.md](./PHASE1-CHANGES.md).
