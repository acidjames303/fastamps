# Phase 1 changes — simplify everyday chrome

**Branch:** `cursor/cadence-ux-master-audit-2475`  
**Code:** `cadence-sales/`

## Goal

Make Cadence feel more intuitive without removing power: shorter primary nav, clearer Calling label, sticky campaign context, admin/platform kept secondary.

## Before → After (primary nav)

| Before (desktop) | After |
|---|---|
| Today, Dialer, Campaigns, Contacts, Results, Team, Admin inbox, Outreach, Insights, Settings | **Today, Calling, Campaigns, Outreach, Inbox, Team** |
| Contacts / Results / Insights / Settings / Prospecting always competing | Moved to **More** (secondary) |
| Dialer | Renamed **Calling** |
| Admin inbox | Renamed **Inbox** |
| No campaign context in chrome | **Campaign chip** when user focuses a campaign |

Mobile bottom tabs: **Today · Calling · Campaigns · Outreach · More** (was Today · Contacts · Dialer · Results · More).

## Files

- `src/lib/navConfig.js` — shared nav source of truth  
- `src/lib/campaignContext.js` — local sticky campaign focus  
- `src/components/CampaignContextChip.jsx`  
- `src/components/Layout.jsx`  
- `src/components/MobileNav.jsx`  
- `src/pages/Campaigns.jsx` — sets active campaign on key actions  

## Preserved

- Outreach routes/functions untouched in behaviour  
- Platform menu for platform_owner  
- Role gates unchanged  

## Deploy

Not published to production `evasive-dial-flow-go` in this step. Local eject tree + optional sandbox copy from eject. Publish only after James reviews.

## Next Phase 1 candidates

- Role-adaptive Today hero (manager vs caller emphasis)  
- Persist campaign context into Dialer/Outreach query params when missing  
- Global Ask Cadence command bar (Phase 2)
