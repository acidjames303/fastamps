# Cadence continuous improvement backlog

**Updated:** 25 Nov 2026 (Europe/London)  
Classify: **P0** critical · **P1** major workflow · **P2** UX/efficiency · **P3** optional

## Active

| ID | Pri | Issue | Evidence | Impact | Status |
|---|---|---|---|---|---|
| CI-001 | P1 | Prospecting research not reliably visible on Dialer after dig-deeper / post-push | BriefPanel only used CompanyIntelligence; push flattens findings once | Callers miss contracts/suppliers/talking points | **Implemented** (awaiting live verify + Builder publish) |
| CI-002 | P1 | Provider mobiles exist but accounts stay “not call-ready” — next action opaque | Ready needs `verified`/`manually_confirmed`; “Use this number” buried under Number candidates; Confirm checkmark does not set prospect phone_status | Oxi-Tech-class lists look incomplete; BDMs re-enrich wastefully | **Implemented** (awaiting live verify + Builder publish) |
| CI-003 | P1 | Multi-tab spreadsheet / email + NL campaign ingest incomplete vs brief | Guided builder exists; multi-worksheet + multi-file understanding uneven | Slow campaign setup | Backlog |
| CI-004 | P1 | Research templates / dictation reuse across Dialer & Outreach | Research workspace in Prospecting; Dialer brief partial | Duplicate research effort | Partially addressed (CI-001 + unified research tabs) |
| CI-011 | P1 | Enrich dialog still exposes ~15 choices despite Maximum-search defaults | `SelectiveEnrichDialog.jsx`: find + method + depth + phone + advanced all above the fold; Maximum banner redundant when preset applied | Slows every enrich; Free/Standard mis-clicks leave lists not call-ready | **Next** (audit cycle 2 — sketch only, not implemented) |
| CI-009 | P2 | Prospecting showed three stacked research panels + duplicate Enrich CTAs | AccountResearchBar + Prompt + Import all visible at once | Decision overload for BDMs | **Implemented** — ProspectResearchWorkspace tabs |
| CI-005 | P2 | Team member drill-down: calls/hour vs login duration clarity | Team page exists; metric definitions need audit | Misleading management decisions | Backlog |
| CI-006 | P2 | Admin Inbox → prefilled lead sheet from qualified outcome | Lead sheet flows exist; discoverability / prefills uneven | Dropped opportunities | Backlog |
| CI-007 | P2 | Reporting download + lead sheets together | getClientReport / Results | Client delivery friction | Backlog |
| CI-008 | P3 | Progressive disclosure polish on dense campaign screens | UX audit | Training burden | Backlog |
| CI-012 | P3 | Prospecting chrome noise | people-v3 banner still shown; `EnrichmentCostPreview` never opened; Campaigns embeds full Prospecting | Training / visual noise | Backlog (cycle 2 runner-up) |

## Done (recent)

| ID | Pri | Summary | Release |
|---|---|---|---|
| — | P1 | FullEnrich phones-only + Maximum search defaults / Lusha widen probe fix | PR #17 / prospecting-search-improve |
| — | P2 | People-v3 ProspectTable (no +N more collapse) | Prior UX branch |

## Parking lot

- Do not create a second campaign builder or second prospect list model.
- Do not auto-send client emails without authorisation.
- CommDecide / wrong-app audits in older docs are superseded — real sales Cadence is cadence.smartfunction.io (app id via env).
