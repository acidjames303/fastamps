# Manual testing handover — FastAmps Connect V1

Updated: 2026-11-24 (Europe/London)  
Audience: FastAmps team (human testing on real phones)  
Live app: https://connect.fastamps.com

**Do not mark this checklist Passed until a human completes it with evidence.**

## Safety rules

- Feature freeze remains in force — test existing behaviour only.
- Use **demo / QA / HOME-BETA** chargers only unless FastAmps assigns a specific Links test code.
- Do **not** enable live Giftbit or issue a real customer voucher.
- Keep admin “Include demo / excluded QA” in mind when searching test claims.
- Prefer a fresh Mailosaur or dedicated test email; avoid overwriting a real installer account.

## Suggested test codes (demo only)

Reserve one code per tester; mark it used after submit.

**Preferred for human manual testing: non-demo Beta stickers**  
download [manual-test-stickers.zip](/opt/cursor/artifacts/manual-test-stickers.zip) or open [PRINT-SHEET.html](/opt/cursor/artifacts/manual-test-stickers/PRINT-SHEET.html).

These use the official FastAmps warranty sticker template and are **live `FastAmps_Beta_500_Codes_Ready` codes** (not demo/QA). They appear in normal **My installs** and follow real reward rules if approved. Mark used after submit. Do not approve/pay unless intentional.

| Serial | PIN | Sticker | Claim URL |
| --- | --- | --- | --- |
| `FA-BETA-0001` | `232581` | [sticker](/opt/cursor/artifacts/manual-test-stickers/FA-BETA-0001-sticker.png) | https://connect.fastamps.com/claim/25422ec6545a42f7ad7ed6b8350efcf5 |
| `FA-BETA-0002` | `515788` | [sticker](/opt/cursor/artifacts/manual-test-stickers/FA-BETA-0002-sticker.png) | https://connect.fastamps.com/claim/a3e20376d70344febd8e56911f6d24e3 |
| `FA-BETA-0003` | `621579` | [sticker](/opt/cursor/artifacts/manual-test-stickers/FA-BETA-0003-sticker.png) | https://connect.fastamps.com/claim/fbe86d77c4764c88b101c363431bd433 |

Demo/HOME-BETA/QA stickers remain available only if needed for segregation testing; they stay hidden from normal installer history by design.

Admin login: use the existing FastAmps admin account (not shared in this doc).

---

## A. Manual installer test (iPhone Safari or Android Chrome)

| # | Step | Pass? | Notes |
| --- | --- | --- | --- |
| 1 | Open https://connect.fastamps.com on phone | | |
| 2 | Register a new test installer | | |
| 3 | Complete email verification / OTP | | |
| 4 | Enter name, business, mobile, location | | |
| 5 | Select preferred wholesaler **and exact branch** | | e.g. Links Electrical / Shrewsbury |
| 6 | Save and inspect profile | | |
| 7 | Update business, mobile, wholesaler/branch | | |
| 8 | Log out and log back in | | |
| 9 | Confirm updated details persist | | |
| 10 | Scan test QR **or** open claim URL above | | Camera permission may be required |
| 11 | Confirm charger identity displays correctly | | |
| 12 | Photograph physical serial-number label (or clear test label photo) | | |
| 13 | Photograph completed installation (or clear test install photo) | | |
| 14 | Enter install date + UK postcode | | |
| 15 | Confirm wholesaler company + branch (prefill editable) | | |
| 16 | Submit installation | | |
| 17 | Confirm success message + installs history entry | | |
| 18 | Admin inspects claim (section B) | | |
| 19 | Admin approves test installation | | |
| 20 | Confirm warranty/reward statuses on installer side | | Demo/QA rewards stay **held** |
| 21 | Check wallet copy: £10 welcome / £10 install / £30 min / 3-install gate | | No USD amounts |
| 22 | Test forgot-password / clear validation errors | | |

### Expected for demo/QA submissions

Immediately after submit (before any admin edit):

- Claim tagged demo / `QA-LAUNCH-2026` or HOME-BETA as applicable  
- Excluded from ordinary commercial reporting  
- Reward **held** (not payable / not Giftbit-ready)

---

## B. Manual administrator test

| # | Step | Pass? | Notes |
| --- | --- | --- | --- |
| 1 | Sign in as admin | | |
| 2 | Find installer (search) | | |
| 3 | Confirm account details accurate | | |
| 4 | Open Installation review | | Enable **Include demo / excluded QA** for QA rows |
| 5 | Locate the submitted install | | |
| 6 | Open both photographs | | |
| 7 | Review serial-number evidence | | |
| 8 | Confirm wholesaler + branch recorded | | |
| 9 | Approve the test install | | Reward should remain held for demo/QA |
| 10 | On a second demo claim (optional): reject | | |
| 11 | On a third demo claim (optional): needs information | | |
| 12 | Confirm installer-facing status updates | | |
| 13 | Confirm reward/voucher statuses accurate | | |
| 14 | Confirm QA rows stay out of ordinary reporting views | | Default list without include-demo |

---

## C. Cannot fully verify without live Giftbit authorisation

- Real UK Giftbit campaign delivery / email inbox fulfilment  
- Live catalogue branding for GBP brands beyond Testbed  
- Automatic payout after admin “send” in live mode  

Keep fulfilment **manual/held** until funding + separate authorisation.

---

## D. After manual testing

Record:

1. Device + browser  
2. Codes used  
3. Pass/fail per step  
4. Screenshots of submit confirmation, admin photo review, wallet  
5. Any defect with severity and repro steps  

Then update launch decision only if evidence supports it.
