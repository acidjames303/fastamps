# Phase 1 — Cadence UX changes

**Date:** 24 Nov 2026  
**Branch:** `cursor/cadence-ux-master-audit-2475`  
**App:** Cadence — Sales Calling Workspace (`6a7338f6106b1962aa31c00a`)  
**Live:** https://cadence.smartfunction.io (also https://evasive-dial-flow-go.base44.app)  
**Source tree:** `cadence-sales/` (ejected)

---

## Guiding principle

Powerful underneath. Effortless on the surface.  
More intuitive **and** more powerful — not more screens.

---

## Nav before → after

### Desktop primary (before)

Today · Dialer · Campaigns · Contacts · Results · Team · Admin inbox · Outreach · Insights · Settings

### Desktop primary (after)

**Today · Campaigns · Prospecting · Calling · Outreach · Inbox · Team**

Secondary (More / user menu): Contacts · Results · Insights · Settings · Get Started  
Platform tools: unchanged dropdown for `platform_owner`

### Mobile bottom tabs (before)

Today · Contacts · Dialer · Results · More

### Mobile bottom tabs (after)

**Today · Campaigns · Calling · Outreach · More**

---

## What changed

| Area | Change | Risk |
|---|---|---|
| `src/lib/navConfig.js` | Shared IA + role filters; Prospecting promoted; Settings secondary | Low — routes unchanged |
| `src/components/Layout.jsx` | Uses navConfig; campaign chip; Settings in user menu for admins | Low |
| `src/components/MobileNav.jsx` | Aligned to shared navConfig / new tabs | Low |
| `src/lib/campaignContext.js` | Sticky campaign in `localStorage` + event bus | Low — client-only |
| `src/components/CampaignContextChip.jsx` | Header chip → opens dialer for that campaign; clearable | Low |
| `src/lib/targetLists.js` | `resolveWorkingListId` prefers sticky campaign when still valid | Medium — changes default dialer list when no `?list=` |
| `src/pages/Campaigns.jsx` | Sets sticky context on Call / Contacts / Prospect / Open; shorter copy; “Call” verb | Low |
| `src/pages/Dialer.jsx` | Syncs sticky campaign from loaded target list | Low |
| `src/pages/Prospecting.jsx` | Sets sticky on campaign/list pick; restores sticky when no last list | Low |
| `src/pages/Today.jsx` | Role-adaptive home: Continue calling; manager approvals/team strip; less instructional text | Medium — layout/CTA changes only; same APIs |
| `src/components/today/TaskRow.jsx` | Primary verb “Call” | None |

### Intentionally untouched

- Outreach mailbox / draft / send / studio flows (nav label only)
- Backend functions (`getTodayWork`, `prepareCallingSession`, `getTeamWorkload`, email APIs)
- FastAmps Connect / SmartFunction playground trees
- No feature deletion; no data model changes

---

## Campaign context retention

**Before:** Prospecting remembered last list; Dialer remembered dial position per queue; Campaigns → Dialer passed `?list=` only for that click. Navigating away often dropped “what am I working on?” chrome.

**After:** `cadence_active_campaign_v1` in localStorage + header chip. Set when:
- Campaigns actions (Call, Contacts, Find prospects, Open, accounts)
- Dialer loads a target list
- Prospecting opens a campaign-linked (or prospect) list

Consumed by:
- Header chip (continue calling)
- Dialer `resolveWorkingListId` fallback
- Prospecting restore when no last-list key
- Today “Continue calling” / sticky name in subtitle

---

## Today / My Day

| Role | Primary surface |
|---|---|
| Caller (`bdm` / similar) | Large **Continue calling** → `prepareCallingSession` → Dialer |
| Manager / admin | Approvals (Manager Inbox count), Team workload snapshot, overdue clear — still can call |
| Empty day | One empty state with Find prospects / Open campaigns |

Removed from first viewport emphasis: long ContextHelp paragraph, “Start calling” wording, competing admin-inbox copy for non-managers.

---

## Deploy status

**Published 25 Nov 2026 (Europe/London)** → https://cadence.smartfunction.io

```bash
cd cadence-sales
npx base44 --app-id "$BASE44_APP_ID" deploy --build -y
```

Published: Phase 1 UX (nav, Today, sticky campaign) + research pack v2 (add your research, dig deeper, `researchAccountsPrompted` merge mode). Live bundle verified for Dig deeper / Add your research / Search further.

---

## Still needs authenticated UI verification

Current agent token cannot open Cadence workspace entities via API (Connect-scoped). Verify after QA login:

1. Caller sees Today → Continue calling ≤3 clicks into Dialer with sticky chip
2. Manager sees Inbox/Team strips when pending/active
3. Campaign selected on Campaigns stays visible on Prospecting / Calling / Outreach
4. Settings / Platform not in everyday primary nav
5. Outreach drafts / mailbox / studio unchanged
6. Mobile More drawer still reaches Contacts, Results, Settings

---

## PR note (for parent / PR #15)

Phase 1 in-repo UX is on this branch under `cadence-sales/`. Docs: this file + prior audit package. No production publish performed.
