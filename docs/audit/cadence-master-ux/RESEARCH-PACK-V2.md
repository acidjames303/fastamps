# Research pack v2 — Cadence-owned company intelligence

**Date:** 25 Nov 2026 (Europe/London)  
**Branch:** `cursor/cadence-ux-master-audit-2475`  
**Principle:** Research runs inside Cadence. You can add your own knowledge and ask Cadence to search further. Cursor is optional later via the same tools.

---

## What you can do now

| Action | Where | What happens |
|---|---|---|
| First AI research | Prospecting → Research accounts / Prompt your accounts | Public-source pass → `AccountResearch` findings |
| Dig deeper | Account row → research → **Search further**, or list **Dig deeper** | Second web pass; **merges** new findings; keeps your notes |
| Add your research | Account research dialog → **Add your research** | Finding stored as `customer_confirmed` on the pack |
| Mark published ↔ yours | Toggle evidence chip on a finding | Same field, different evidence class |
| Import a doc | Research import panel | Existing path — sections per `## Company` |
| CRM sync | Dig deeper / prompted research | Updates `CompanyIntelligence` when `prospect.company_id` exists |

---

## Data model (unchanged entities, richer use)

- **`AccountResearch`** — per-account pack for a list + instruction (`prompt_hash`). Findings carry `evidence`: `published` | `customer_confirmed` | `unverified`.
- **`CompanyIntelligence`** — org-level company brain (summary, roles, signals). Refreshed when prompted/deeper research runs against a linked company.
- **Merge rule** — dig deeper does not wipe confirmed notes; duplicates by label+value are skipped; confirmed wins on label clash.

---

## Backend

- `researchAccountsPrompted` accepts `mode: "deeper"` and optional `focus`.
- Shared `mergeFindings()` in `base44/shared/researchFindings.ts`.

---

## Intentionally not done yet

- Live publish to Base44 production (needs your OK).
- App MCP / Cursor driving the same tools (Phase 3).
- Auto-always-on crawler (guided autopilot only).

---

## Next product steps (when you want them)

1. Surface research pack on Dialer / call prep card.
2. Credit estimate before dig-deeper batches.
3. Expose `researchAccountsPrompted` + append-finding tools on App MCP for JP.
