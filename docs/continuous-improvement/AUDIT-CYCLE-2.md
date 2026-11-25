# Audit notes — CI cycle 2 UX prioritisation (25 Nov 2026, Europe/London)

Overnight UX audit (recommendation only; enrich-dialog change **not** implemented here). Theme: **Powerful underneath. Effortless on the surface.**

Focus pages: Prospecting (`Prospecting.jsx`, `ProspectTable`, `SelectiveEnrichDialog`), Dialer/Today, Campaigns hub.

Sibling work on this branch already lands **CI-009** (`ProspectResearchWorkspace` tabs). This audit selects the **next** highest-impact safe simplification.

---

## 1. Top recommendation — CI-011 Confirm-first SelectiveEnrichDialog

**What:** Collapse the enrich dialog so the default surface is Maximum-search summary + estimate + Start → existing paid confirm. Put field / method / depth / phone / provider controls behind **Adjust search**.

**Files:**
- Primary: `cadence-sales/src/components/prospecting/SelectiveEnrichDialog.jsx`
- Related (no API change): `PhoneCoverageOptions.jsx`, `RunEstimatePanel.jsx`, `lib/enrichmentRun.js`
- Call sites unchanged: `Prospecting.jsx` (`openEnrichDialog`, `openProviderEnrich`)

**Current friction:** After Maximum-search defaults (PR #17 / `applyMaximumSearchPreset`), opening Enrich still shows ~15 decisions above the fold: redundant Maximum banner, 4 find checkboxes, 3 search methods, 3 depths, phone coverage, advanced accordion, then estimate + Start + confirm. Free / Standard mis-clicks under-search lists and force re-runs.

**Commercial value:** Enrich is on the critical path to call-ready volume. Confirm-first cuts time-to-run, protects Lusha utilization (defaults already correct), and reduces “enriched but not call-ready” loops that CI-002 only fixed downstream.

**Safety:** UI-only. Same `startEnrichmentJob` payload. Keep provider-credit confirm. No schema / secrets / spend-control / waterfall edits.

---

## 2. Runner-ups

| # | Idea | Files | Friction |
|---|---|---|---|
| R1 | Remove people-v3 hard-refresh banner | `Prospecting.jsx` ~750–756 | Permanent emerald notice above every session |
| R2 | Delete or wire dead `EnrichmentCostPreview` | `Prospecting.jsx` (`costPreviewOpen` never set true) | Dead state + unused modal |
| R3 | Slim Campaigns “Find prospects” embed | `Campaigns.jsx` embeds full `Prospecting` | Competing entry vs `/prospecting` nav; doubles chrome |

Today already has one primary CTA; Dialer brief path improved in cycle 1 — lower priority than enrich confirm-first.

---

## 3. Explicitly do NOT touch

- `startEnrichmentJob` / `pollEnrichmentJob` / batch processors
- Provider waterfall, FullEnrich phones-only caps, spending controls
- Secrets, auth, org isolation, schema migrations
- Live enrichment spend in tests; inventing contacts/phones
- Second campaign or prospect-list builder

---

## 4. Implementation sketch (CI-011 only) — not built this pass

See backlog CI-011 and the agent reply for props/state/copy (`simpleMode` / `adjustOpen`, default Maximum surface, Adjust accordion wrapping existing sections).
