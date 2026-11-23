# FastAmps Connect — launch simulation harness

External QA tooling only. **Does not add product features.**

## Goal

Support the autonomous launch agent’s 20-installer / ≥400-installation stress plan against Connect, with a hard feature freeze.

## Environments

| Mode | Flag | Use |
| --- | --- | --- |
| Dry-run | default | Generate fixtures + validate CSVs locally; no network writes |
| Isolated | `CONNECT_QA_MODE=isolated` | Point at a non-production Connect/Base44 app with its own DB |
| Production authorised | `CONNECT_QA_MODE=production-authorised` **and** `CONNECT_QA_CONFIRM=QA-LAUNCH-2026` | Only after human approval |

Production stress without both flags is refused.

All synthetic emails/companies/batches must include `QA-LAUNCH-2026`.

## Scripts

```bash
# From launch-readiness/simulation
npm run generate:fixtures   # 20 installers + 420 serial/PIN CSV
npm run dry-run             # Validate fixtures only
npm run smoke               # Public probes + live JS publish detection
npm run concurrency-plan    # Stages 1 → 5 → 10 → 20 (no API writes)
# Playwright/API E2E requires CONNECT_BASE_URL + credentials + authorised mode
```
## Giftbit

Never create chargeable production campaigns for QA identities. Use admin readiness checks / non-fulfilment boundary only.

## Feature freeze

These scripts must not be used as a reason to build new Connect product UI. They only drive existing journeys.
