# Phase 10 — US / international commercial feasibility (read-only)

Updated: 2026-11-23 (Europe/London)  
**Not authorised for V1 implementation.**

## 1. What UK V1 supports today

- Single-tenant FastAmps Connect experience on Base44.
- GBP wallet amounts (£10 welcome, £10 per approved install, £30 first redemption floor, three-install gate).
- UK postcode validation, UK mobile patterns, UK wholesaler free-text company + branch.
- Giftbit integration oriented to UK fulfilment; production auto-send remains gated / held for demo and until live GBP funds/permissions are confirmed.
- QA segregation via `is_demo` / `excluded_from_reporting` / reward holds.

## 2. What USD Giftbit Testbed proved

- Isolated harness can authenticate to Giftbit Testbed, create a USD marketplace campaign, and observe provider statuses (`DELIVERED` / `SENT_AND_REDEEMABLE` for Amazon US in prior probe).
- Duplicate campaign IDs are rejected by the provider.
- GBP Testbed campaigns hit `FUNDS_REQUIRED` — Testbed funding does **not** prove UK live delivery.
- **Does not** prove production UK or US payouts, tax handling, or multi-currency wallets inside Connect.

## 3. New development required for other businesses / US

| Capability | Effort nature |
| --- | --- |
| Multi-currency wallets with explicit `GBP`/`USD` ledgers | New product + migration + reconciliation |
| Region catalogues and reward denominations | Config + admin + Giftbit account mapping |
| Client-specific branding / white-label | New tenancy + asset pipeline |
| Separate business accounts and data isolation | AuthZ model, row-level tenancy, reporting fences |
| Country eligibility / serial registers | Rules engine + import tooling |
| Local privacy (UK GDPR vs US state privacy) | Legal + product disclosure work |
| Tax / accounting exports | Finance integrations |
| Currency-specific minima and messaging | Copy + wallet math per tenant |

## 4. Technical feasibility verdict

**Feasible as a future platform**, not as a toggle on V1. The current architecture is a UK single-programme app with hard-coded commercial copy and GBP assumptions. Extending safely needs explicit currency codes, tenant boundaries, and separate Giftbit credentials — not symbol swaps.

## 5. Main commercial & security considerations

- Never mix Testbed recipients into live financial records (already a V1 safeguard).
- Keep QA/demo exclusion from genuine reporting.
- Separate Giftbit funding accounts per currency/client.
- Contractual clarity on who is merchant of record for rewards.
- Avoid “temporary” production currency flips; use isolated environments only.

## Freeze confirmation

No international, multi-currency, or white-label features were implemented under this audit.
