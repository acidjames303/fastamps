# Feature-freeze compliance record

All work under the launch-readiness exercise must repair or stabilise **existing** Connect behaviour only.

| Change area | Classification | Notes |
| --- | --- | --- |
| Public privacy/terms routes | Fix | Restore missing legal routes; no new product workflow |
| PWA icons / meta | Fix | Branding correctness for existing PWA |
| Proof-docs gate on voucher | Fix | Enforce existing programme rule |
| Remove Alpha 7 tile | Fix | Remove unsupported marketing claim |
| Hide unfinished More items | Fix | Avoid exposing unfinished surfaces |
| AdminRoute | Fix | Enforce existing admin permission model |
| Mobile duplicate check | Fix | Existing registration integrity |
| Bootstrap query hardening | Fix | Security of existing bootstrap |
| Photo capture attribute | Fix | Existing upload flow |
| Auth polish | Fix | Existing login/reset |
| `launch-readiness/` agent expansion | External QA | Orchestrator only — not Connect product UI |
| `launch-readiness/simulation/` | External QA | Fixtures + gated runners — not Connect features |

**Confirmed:** no new dashboards, integrations, incentive rules, or installer journeys were introduced as product features.
