# FastAmps Connect V1 — Testing & Feature Check Register

Created: 12 October 2026
Status: Test cases documented; **no live/end-to-end scenario is marked passed by the code build alone**.
Owner: FastAmps team (JP, Ed, Cara, Alan, Emily as appropriate).
Live working checklist: Admin → QA checklist (/admin/qa). The admin results are stored in the QaTestResult database.

## How to use this register

1. Use dedicated testing accounts and clearly marked demo chargers. Avoid production Giftbit payouts.
2. Open Admin → QA checklist, expand a scenario, perform the test and record evidence/notes.
3. Mark Passed, Failed, Blocked or Not tested. Do not mark Passed without evidence.
4. Prioritise the Critical scenarios and record device/browser and reproduction steps when anything fails.
5. Re-test after fixes, especially QR/serial duplicate protections and fraud/payout boundaries.

## Live-release gates

- All Critical scenarios pass with evidence, including multi-session duplicate claims, payment holds and referral qualification.
- FastAmps leadership approves the commercial incentives and applicable developer/employer exclusions.
- The installer/referral terms, privacy notice, UK legal/tax implications and Giftbit/live funds workflow receive appropriate sign-off.
- Real mobile testers achieve a roughly 60-second submission while providing both readable photos.
- Wholesaler supply vs installer reported purchase is monitored without automatic false fraud allegations.
- No beta or legacy demonstration claim can turn into redeemable credit. Audit old HOME-BETA data.
- Confirm concurrent voucher/claim requests cannot create duplicate incentives; database-level uniqueness / transactional locking needs special scrutiny.

## Feature inventory added in October 2026

- Mandatory serial plus six-digit PIN; secure QR lookup and permanent manufacturer charger record.
- Two installation evidence photos; individual admin rejection reasons and separate warranty/reward decisions.
- Optional distribution CSV, approved branch directory, deferred label generation and supply-vs-purchase review.
- Installer-visible referral tracker; 5 unique approved installs for £20 credit.
- Enrolment terms acknowledgement and existing-installer re-acknowledgement.
- Admin fraud holds/rejections, audit history, distinct reward statuses and voucher approval ahead of fulfilment.
- Persistent QA checklist and safer HOME-BETA marking.

## Open considerations, not verified by a build

- Two simultaneous QR submissions can race if the backing database does not provide a unique/atomic serial claim constraint.
- Phone number and email checks detect common repeat registrations but cannot prove real identity.
- Photos must be visually reviewed; they do not independently certify electrical installation compliance.
- Released holds and disputed referral credits need testing after partial redemption, especially Giftbit orders already accepted.
- Existing historic test accounts and old beta claim records require an admin data audit before live launch.
- The text of programme terms is a product draft, not legal sign-off.

## Scenarios (44 total, 26 critical)

### Installer onboarding and terms

- [ ] **ONB-01 · New installer must accept terms to enrol** — CRITICAL
  - Steps: Use a new installer account, leave the enrolment terms checkbox unchecked, and attempt registration. Then accept and submit.
  - Pass: Registration is blocked until acknowledgement. Account records the correct programme version and timestamp.
- [ ] **ONB-02 · Existing installer must acknowledge updated terms** — CRITICAL
  - Steps: Sign in with a pre-change installer account and visit Profile and Rewards. Accept the current terms from Profile.
  - Pass: Reward redemption is blocked before acceptance, available after acceptance if eligible. The acceptance is persisted.
- [ ] **ONB-03 · Duplicate mobile number and self-referral are refused** — CRITICAL
  - Steps: Try to create a second installer with an already-used mobile number; then try the original referrer code with the same person.
  - Pass: Neither attempt creates a second eligible referral or welcome reward. A legitimate user is directed to account recovery/support.
- [ ] **ONB-04 · Invalid, blocked or rejected referral code** — HIGH
  - Steps: Register with an invalid code, then a code associated with a blocked or ineligible referrer.
  - Pass: Registration cannot attribute the referral to an invalid or blocked account. Errors are clear without exposing other installers’ details.

### Charger verification and installation evidence

- [ ] **QR-01 · Real QR resolves matching serial number and PIN** — CRITICAL
  - Steps: Scan a labelled test charger on iPhone and Android. Check returned charger and continue to claim.
  - Pass: Correct physical unit is linked to permanent charger record. No manual PIN entry needed from a specific QR.
- [ ] **QR-02 · Manual fallback requires both serial and six-digit PIN** — CRITICAL
  - Steps: Try PIN alone, wrong serial, wrong PIN, unknown serial, and a valid matching pair. Include a PIN with leading zeros.
  - Pass: Only exact imported serial/PIN pair is accepted; error states do not identify other charger records.
- [ ] **QR-03 · Two compulsory physical installation photos** — CRITICAL
  - Steps: Attempt submission with no images, label only, installed charger only, then both. Try camera and photo library.
  - Pass: Two distinct valid photos are required. The label photo visibly contains the charger’s serial; second shows the complete wall installation.
- [ ] **QR-04 · Van/stock claim must not earn a reward** — CRITICAL
  - Steps: Scan an uninstalled charger but submit misleading or insufficient evidence. Review both photos as admin.
  - Pass: Claim remains pending or is rejected by reviewer; no reward is approved just for scanning. Review reason explains missing evidence.
- [ ] **QR-05 · Repeat or simultaneous claims for one serial** — CRITICAL
  - Steps: Submit from one installer then attempt the same charger with a second account or two browser sessions at once.
  - Pass: Only one eligible claim/reward exists for the physical unit. Concurrent race must not create two approved/payout-eligible claims.
- [ ] **QR-06 · Admin comparison, rejection reasons and resubmission** — HIGH
  - Steps: Review both photos, reject using each reason, and request information. Reopen an approved claim when appropriate.
  - Pass: All five rejection reasons work; serial mismatch is visible; status/history persist; reopened claims never free charger to be claimed again.
- [ ] **QR-07 · Charger imported without QR labels is not claimable** — HIGH
  - Steps: Save a charger record only, then try registering its serial/PIN before generating labels.
  - Pass: Database record exists but claims are blocked until admin activates QR labels.
- [ ] **QR-08 · Postcode, photo compression and upload errors** — HIGH
  - Steps: Test valid/invalid UK postcodes, poor signal, large images, upload failure and retry on mobile.
  - Pass: Errors are recoverable; no incomplete claim becomes reward approved; photo quality remains readable.

### Manufacturing and distributor CSV

- [ ] **CSV-01 · Legacy two-column manufacturing CSV** — CRITICAL
  - Steps: Import CSV containing only serial_number and pin_code, including leading-zero six-digit PINs.
  - Pass: Charger records persist and the original workflow still generates correct QR labels without needing optional supply data.
- [ ] **CSV-02 · Expanded CSV with wholesaler, customer, branch and batch** — HIGH
  - Steps: Import valid expanded CSV with empty optional values, customer rows, embedded commas and multiple batches.
  - Pass: Original supplied-to names, branches and batch IDs persist independently of QR printing.
- [ ] **CSV-03 · Duplicate serial within or across batches is refused** — CRITICAL
  - Steps: Try the same serial twice in one file and again in a second import with a different PIN.
  - Pass: The second serial is rejected; existing charger data and claim ownership stay unchanged.
- [ ] **CSV-04 · Unmatched or ambiguous wholesaler branch review** — HIGH
  - Steps: Import CEF Bedford and CEF Bedfordshire, test explicit aliases, then manually link the unmatched name to a confirmed branch.
  - Pass: No fuzzy match is silently applied. Original text is preserved and reviewed canonical branch appears after confirmation.
- [ ] **CSV-05 · Save records first, activate QR and export distribution later** — HIGH
  - Steps: Import without printing. Activate labels in a later session, download and scan. Export claim report after installer declares wholesaler.
  - Pass: Records and branch data persist; labels become scannable later; supply-vs-purchase difference is shown for review, not auto-rejected.

### Referrals and 5-install milestone

- [ ] **REF-01 · Referral appears only after valid registration** — CRITICAL
  - Steps: Share a code without registering, then register a distinct tester account with it.
  - Pass: Sharing alone is not counted. Completed registration appears once in the referrer’s Profile referral tracker.
- [ ] **REF-02 · Progress increases only for unique approved eligible installs** — CRITICAL
  - Steps: For the referred tester, record 1–5 approved distinct chargers; include pending, rejected, held and demo claims as negative cases.
  - Pass: Progress shows 0/5 through 5/5; excluded statuses and duplicate serials do not advance the reward milestone.
- [ ] **REF-03 · Exactly one £20 credit on reaching 5/5** — CRITICAL
  - Steps: Approve fifth eligible install, refresh Profile and wallet, then replay sync or approve another claim.
  - Pass: One £20 credit per eligible referred installer, with no extra credit on repeat sync or sixth installation.
- [ ] **REF-04 · Referral hold, rejection, release and awarded-credit dispute** — HIGH
  - Steps: Hold and reject an attributed referral, then release it. Repeat after a reward was awarded; inspect referrer wallet.
  - Pass: Held/rejected referrals cannot unlock new credit. Already-awarded suspicious credit holds referrer wallet for manual review, not silent reversal.
- [ ] **REF-05 · Referrer only sees limited referral details** — HIGH
  - Steps: Log in as referrer and inspect the tracker with several distinct users.
  - Pass: Shows shortened name, registration date, approved count and remaining count only; no email, mobile, photo, serial or postcode.
- [ ] **REF-06 · Previously approved install reversed after referral award** — HIGH
  - Steps: After 5/5, move one installation back to review or reject, then request a referral payout.
  - Pass: Questioned credit is held for fraud review and cannot be redeemed without manual investigation.

### Wallet, voucher requests and payouts

- [ ] **PAY-01 · Reward wallet states are accurate** — CRITICAL
  - Steps: Create pending, approved, held, rejected, requested and issued test reward records using controlled admin actions.
  - Pass: Six categories are distinct. Held/rejected values never inflate withdrawable balance or become payable.
- [ ] **PAY-02 · First redemption requires 3 approved installs and £30** — CRITICAL
  - Steps: Try claiming at £20, at £30 with only two qualifying installs, then with three and sufficient balance.
  - Pass: Request is rejected until BOTH first-redemption conditions hold; signed terms are required.
- [ ] **PAY-03 · Voucher request never automatically issues Giftbit reward** — CRITICAL
  - Steps: Request a test voucher with a qualified account. Inspect the request before any admin action.
  - Pass: Request remains pending FastAmps review. Giftbit is not contacted by initial installer request.
- [ ] **PAY-04 · Installer, referral, claim or voucher hold blocks payout** — CRITICAL
  - Steps: Apply each hold separately before request/send and try both manual and Giftbit admin actions.
  - Pass: No voucher is issued from any held, blocked or ineligible reward. Admin must record a reason before release.
- [ ] **PAY-05 · Overlapping voucher requests and duplicate payout tokens** — CRITICAL
  - Steps: Try overlapping requests for same serial, welcome bonus or referral token. Try different sessions and refreshed admin screens.
  - Pass: Second payment is blocked by server validation; payment cannot be marked issued directly from installation approval.
- [ ] **PAY-06 · Giftbit testbed, delayed funding and issuance state** — HIGH
  - Steps: Only in Giftbit testbed: submit an admin-approved eligible request, check pending-funds, refresh status, and handle provider error.
  - Pass: Provider status matches the request and no duplicate campaigns are sent. Do not use live provider or real voucher funds for QA.
- [ ] **PAY-07 · Previously issued voucher cannot be recalled** — HIGH
  - Steps: Mark controlled request as sent in a simulation and attempt to put it on hold.
  - Pass: System explains issued vouchers cannot be reversed; future account rewards can be held separately.

### Fraud-review controls and privacy

- [ ] **ADMIN-01 · Every fraud action requires reason and creates audit entry** — CRITICAL
  - Steps: Hold, release, reject or block using the new Fraud review page, first with empty/short reason.
  - Pass: Reason is required; admin/date/action/target are recorded; held and rejected states survive page reload.
- [ ] **ADMIN-02 · Installer access is isolated from other accounts** — CRITICAL
  - Steps: Use two different installer logins to inspect each other’s claims, private photos, profile and referral progress.
  - Pass: Neither user can access the other’s detailed data. Only FastAmps admins see evidence and fraud audit history.
- [ ] **ADMIN-03 · Warranty status remains separate from reward fraud decision** — HIGH
  - Steps: Register legitimate installation, approve warranty, then hold or reject only its reward.
  - Pass: Warranty remains registered while incentive remains held/rejected; admin understands the independent states.

### Installer experience and pilot

- [ ] **FIELD-01 · Installer can finish claim in around 60 seconds** — CRITICAL
  - Steps: Have 3–5 installers time real mobile QR → postcode → serial label photo → wall photo → submission.
  - Pass: Median near 60 seconds and no confusing errors, with both photos clear enough for review.
- [ ] **FIELD-02 · Print/scan high-contrast A4 adhesive QR labels** — HIGH
  - Steps: Print with ordinary mono office printer on selected Avery-compatible stock; scan multiple labels at varied angles and lighting.
  - Pass: Serial and QR are readable; dimensions align; no expensive dedicated printer or reprinting required.
- [ ] **FIELD-03 · Wholesaler branch and installer pilot** — HIGH
  - Steps: Pilot with a small set of participating branches, legitimate installers and sample chargers; compare supply report to actual claims.
  - Pass: Record completion rate, reviewer workload, false flags, fulfilment costs and branch feedback before wider launch.

## Production warranty-registration label QA

- [ ] **FIELD-04 · 2 × 3-inch label concept print proof and QR scan** — CRITICAL
  - Steps: From Admin → QR batches, print the new standard 50.8 × 76.2 mm warranty-registration label at Actual size on a mono laser printer. Test A4 3 × 3 batch layout, margins, text, white logo and blue branding, plus iPhone/Android scanning. Use a marked demo charger only.
  - Pass: The white-on-navy FastAmps logo, REGISTER WARRANTY call to action, £10 approved-install reward and £10 new-installer welcome bonus are readable. Each printed label measures 50.8 × 76.2 mm, and each QR resolves to the appropriate test charger.

- [ ] **FIELD-05 · Standard label rendering and batch PDF regression** — HIGH
  - Steps: Create two distinct test chargers plus a 10-charger batch; download individual PDFs and the full A4 batch PDF; check the final label remains consistent, all serials/PINs differ correctly, and the 10th label appears on page two.
  - Pass: Production label previews and exports use the new single approved warranty template only. Individual PDFs measure 2 × 3 inches; batch PDFs contain up to nine labels per A4 page, with no missing, duplicated or unscannable charger codes.

Current production design: white official FastAmps logo on a navy header, FastAmps blue #0066FF stripe and dots, REGISTER WARRANTY, SCAN • REGISTER • EARN, physical QR, £10 per approved install, plus NEW TO FASTAMPS CONNECT? +£10 WELCOME BONUS, original serial and PIN. The batch exporter makes A4 3×3 sheets with physical 50.8×76.2mm labels, and individual exports are exactly 2×3-inch PDFs. Print at 100%. The former Label Studio has been removed.

## Fixed artwork compositor and Avery settings (12 October 2026)

The QR generator now accepts a fixed uploaded Base44 file. All visual artwork is sourced from the exact image (1024×1536 pixels), cropped to the 2×3-inch label; only the square QR and the serial/PIN value areas are composited dynamically. Setup location: Admin → QR batches → Fixed QR label artwork. No new design studio.

Before using the image-based labels, an administrator must upload the supplied blank QR artwork via the new upload control; Base44 does not automatically receive images attached inside ChatGPT. Existing code-generated labels remain the fallback until the upload is completed.

- [ ] **FIELD-06 · Fixed uploaded artwork changes only QR, serial and PIN** — CRITICAL
  - Steps: In Admin → QR batches, upload the approved 1024×1536 blank-template artwork. Generate two chargers with different serials and PINs. Compare their downloaded labels pixel-by-pixel outside QR and the two value areas.
  - Pass: Logo, layout, typography, colours, reward messages, and headings remain pixel-identical. The QR resolves to each correct charger and the six-digit PIN preserves leading zeros.

- [ ] **FIELD-07 · Physical Avery 2×3 sheet fit and multi-page QR batch** — CRITICAL
  - Steps: Enter the exact Avery product number, margins, rows, columns and gaps from the paper pack. Print 10 different test chargers at Actual size. Measure a sample, inspect page two, and scan labels on iPhone and Android.
  - Pass: Each label measures 50.8×76.2 mm; the first nine fit the chosen A4 sheet if 3×3 is supported by that product; the tenth appears on the next page with the matching serial and PIN; all scans resolve uniquely.


## Large-batch import, permanent PIN history, stock status and QR speed updates

- New import route: an admin-only Base44 function checks every CSV row against all current serials/PINs AND permanently recorded identifier history. Both serials and PINs must be unique, including within the same CSV. Supports up to 10,000 rows per request, subject to live backend execution limits.
- The import route uses bulkCreate in chunks and attempts a rollback of all records tagged with the same import ID after a write failure. A true ACID/database unique-index guarantee is not available from the current Base44 entity layer; concurrent writes need a live test. No physical chargers have been changed for these tests.
- Retire charger records through the new server action so PIN and serial histories remain reserved. Historic records deleted before this change cannot be reconstructed without archive records.
- Field/distribution dashboard in Admin → QR batches shows allocated, recorded dispatched, dispatched/unclaimed, submitted and approved. Wholesaler allocation must not be confused with confirmed deployment. Demo/test names are excluded by default.
- QR backgrounds now load once per template instead of for each QR. Labels render at 400 dpi (800×1200) instead of 600 dpi (1200×1800), with a capped preview cache; print labels are not retained in that cache. iPhone/Android scanning and 100-label physical prints remain to be tested.

- [ ] **CSV-06: 1,000+ CSV serial and PIN duplicate preflight** (critical)
  - Steps: Upload a 1,200-row CSV with a reused serial number, a reused six-digit PIN, duplicate values within the file and a leading-zero PIN. Inspect row-level errors, download the error report and try the import.
  - Pass: All records in the file are checked against the full charger register and identifier history. Invalid or reused codes block the entire upload with no charger created.
- [ ] **CSV-07: Import rollback and permanent PIN history** (critical)
  - Steps: Use a controlled failed-write simulation midway through a large import. Confirm rollback; then import and retire a charger and attempt to reuse its old PIN with a different serial.
  - Pass: Failed imports leave no usable partial batch. A retired charger PIN stays reserved. No PIN or serial is silently reused.
- [ ] **FIELD-08: Dispatch and unclaimed charger reporting** (high)
  - Steps: Mark a controlled real batch as dispatched, submit and approve some of its installation claims, and inspect the status totals, filters and CSV export.
  - Pass: Reported dispatch is kept separate from wholesaler allocation and completed installation. Only still-unclaimed dispatched serials appear in the unclaimed count. Demo/test batches are excluded from operational totals by default.
- [ ] **FIELD-09: Fixed-template QR rendering speed and quality** (high)
  - Steps: Time cold and warm batches of nine labels and a 100-label PDF on a normal laptop. Compare with previous rendering speed; scan QR codes from inkjet and laser-printed labels.
  - Pass: The fixed background is reused across labels and batch PDFs do not retain every large image in memory. Correct unique QR codes and original graphic remain legible at 2×3 inches.
