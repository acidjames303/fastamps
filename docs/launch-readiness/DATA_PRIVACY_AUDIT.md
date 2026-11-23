# Phase 6 — Data collection & privacy audit (V1 freeze)

Updated: 2026-11-23 (Europe/London)  
Scope: existing FastAmps Connect fields only. Flag legal items; do not remove business-critical data without approval.

## Summary

Connect collects identity, contact, commercial purchase context, installation evidence (including optional GPS), and reward fulfilment data. Most fields are essential for warranty, wholesaler attribution, fraud review, or Giftbit fulfilment. Disclosure exists via Privacy / Terms routes; specialist UK GDPR / PECR legal sign-off remains **external**.

## Field inventory (installer-facing)

| Area | Field | Why required | Essential? | Validation | Correctable? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Registration | Email | Account + OTP | Yes | Auth provider | Via support / new account | Duplicate email rejected |
| Registration | Password | Access control | Yes | Min length enforced in UI | Reset flow | |
| Registration | OTP | Email verify | Yes | Mailosaur/prod mail | Resend | |
| Onboarding | Full name | Identity / admin review | Yes | Length | Profile | |
| Onboarding | Business name | Trade context | Yes | Required | Profile | |
| Onboarding | UK mobile | Contact / duplicate guard | Yes | 11-digit pattern + unique check | Profile with duplicate check | |
| Onboarding | Region / coverage | Ops planning | Yes | Required | Profile | |
| Onboarding | Nominated wholesaler + branch | Commercial default | Yes | Required on onboarding | Profile | Prefills install form; overridable per claim |
| Install | Serial + PIN / QR | Charger claim | Yes | Register match | Resubmit if rejected | Reuse blocked |
| Install | Install date | Warranty timeline | Yes | Date | Needs_info / resubmit | |
| Install | Site postcode | Location evidence | Yes | UK format + postcodes.io | Needs_info / resubmit | |
| Install | Wholesaler company | Purchase attribution | Yes | **Required** UI + backend (published) | Per submission | Commercially critical |
| Install | Wholesaler branch/town | Purchase attribution | Yes | **Required** UI + backend (published) | Per submission | |
| Install | Serial photo + install photo | Evidence | Yes | HTTPS image URLs | Needs_info | Camera capture preferred |
| Install | Photo GPS (device/EXIF) | Fraud / site corroboration | Optional when available | Numeric lat/lon | N/A | Sensitive location data — retention/legal review |
| Install | Consent confirmation | Programme terms | Yes | Boolean true | | |
| Wallet | Reward balances / statuses | Incentive integrity | Yes | Server rules | Admin lifecycle | Demo/excluded held at £0 |
| Voucher | Recipient email / Giftbit refs | Fulfilment | Yes when redeeming | Admin + provider | Admin | Testbed ≠ production proof |
| Account | Delete account | Rights request path | Existing | Function | | Retention after delete needs legal review |

## Admin / reporting

- Admin sees installer identity, claim evidence, wholesaler fields, reward/voucher status.
- QA cohort uses `is_demo` + `excluded_from_reporting` so synthetic rows stay out of live reporting by default.
- Admin installs UI now supports **Include demo / excluded QA** for intentional review without polluting default ops views.

## Duplication & consistency

- Nominated wholesaler (profile) vs per-install wholesaler: intentional; install must still require both company and branch.
- Installer name/email copied onto claims for review speed — keep in sync via claim-time snapshot (existing behaviour).

## Compliance flags (legal / specialist — not assumed compliant)

1. Lawful basis and retention schedule for installation photographs and GPS.
2. Giftbit as processor / international transfer clauses for reward emails.
3. Marketing vs transactional SMS/email if mobile is reused beyond OTP/support.
4. Account deletion completeness (entities, photos, Giftbit recipient copies).
5. DPIA for location-bearing photo metadata at scale.

## Freeze-safe recommendations only

| ID | Change | Status |
| --- | --- | --- |
| WHOL-REQ-001 | Require wholesaler + branch on submit | Done (UI + published backend) |
| ADMIN-QA-001 | Search + include excluded toggle | Done (frontend deploy) |
| PRIV-COPY-001 | Keep Privacy/Terms links visible on auth | Already in source/live |
| LEGAL-EXT-001 | External counsel review of retention + GPS | Documented; not engineering |

## Out of scope (future)

- Field removal campaigns, new consent banners, multi-region privacy centres, automated retention jobs.
