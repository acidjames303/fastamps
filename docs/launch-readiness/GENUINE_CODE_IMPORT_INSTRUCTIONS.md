# Genuine charger code import — JP instructions

**Status:** Infrastructure ready. Do **not** import or invent genuine manufacturing codes until Edd authorises them and JP supplies the official file.

## What is already in place

- Admin → **QR batches** (`/admin/chargers`) uses the existing CSV importer.
- Server validation: `import-charger-batch` checks serial/PIN format, in-file duplicates, and collisions against the full `Charger` + `ChargerCodeHistory` register.
- QR sticker export uses the official FastAmps warranty registration template.
- Links Electrical Shrewsbury programme record exists in **Admin → Programmes** as **draft / inactive**.
- Live claims for Links-allocated non-demo chargers are blocked while the programme is not `active`.

## When Edd authorises the genuine codes

1. Receive the authorised serial / PIN file from JP (and QR identities if supplied).
2. Do **not** convert QA, demo, HOME-BETA, TRADE-SHOW, or the earlier synthetic FA-BETA manual-test rows into genuine commercial stock.
3. In Admin → **QR batches**:
   - Choose a new unique batch reference, e.g. `LINKS-SHREWSBURY-GENUINE-YYYYMMDD`.
   - Upload CSV with at least: `serial_number`, `pin_code`, `product_model`.
   - Recommended distribution columns:
     - `supplied_to_type` = `wholesaler`
     - `supplied_to_name_raw` = `Links Electrical`
     - `supplied_to_branch_raw` = `Shrewsbury`
     - `source_batch_identifier` = authorised batch id from manufacturing
4. Review validation issues (duplicates / invalid PINs) before commit.
5. Export printable QR stickers only after a clean import.
6. Confirm programme invitation QR at `/invite/links-electrical-shrewsbury` (still inactive until activation).
7. Complete the manual real-world checklist.
8. Only then, with JP explicit approval, activate the programme in **Admin → Programmes**.

## CSV requirements

| Field | Rule |
| --- | --- |
| `serial_number` | Unique across the live register |
| `pin_code` | Exactly 6 digits; preserve leading zeros |
| `product_model` | e.g. `Alpha 7` |

PIN example that must remain text: `003587`.

## Safety gates

- Programme activation requires `confirm_activation=true` in the admin API and a UI confirmation.
- Giftbit live UK payouts remain held / manual until separately authorised.
- No genuine funds are released by import alone.
