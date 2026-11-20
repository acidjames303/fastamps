---
name: admin-ops-audit
description: Audit FastAmps Connect administrator operations for the one-wholesaler pilot.
---

# Admin operations audit

## Checklist

1. Installer directory visibility and exports.
2. Charger serial/PIN inventory and QR label generation.
3. Bulk CSV import validation, including a synthetic 500-row unique batch.
4. Duplicate serial/PIN detection and rollback behaviour.
5. Installation evidence review and rejection reasons.
6. Voucher / Giftbit status handling — failed provider calls must not mark rewards sent.
7. Fraud holds.
8. Confirm ordinary installers cannot use admin APIs or see other installers' private data.

## Safety

Do not import into production without an approved pilot batch reference.
Prefer the local harness in `tests/chargerCsvImport.test.mjs` for large synthetic imports.
