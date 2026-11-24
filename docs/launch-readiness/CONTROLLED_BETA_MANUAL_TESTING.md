# Manual real-world testing pack (JP / FastAmps)

Production: https://connect.fastamps.com  
Use synthetic QA accounts and test chargers only. Do **not** use Edd-authorised genuine codes until supplied.

## A. Nationwide pre-registration

1. Open https://connect.fastamps.com (should land on **Welcome**).
2. Tap **Pre-register your interest**.
3. Complete name, business, email, password, mobile, town, postcode, coverage area.
4. Search wholesaler (try `Links Shrewsbury`, `CEF`, `Edmundson Telford`). Select an **exact branch**.
5. If nothing matches, use manual wholesaler + branch — confirm earlier fields remain filled.
6. Accept privacy + notification options → Continue → enter email OTP.
7. Confirm screen: **You're on the list!**
8. Sign in and confirm Home shows the interest-list message (not live rewards).
9. Admin → **Programmes**: find the installer under Pre-registered; check preferred branch/town/postcode.

## B. Confirmation email

1. Check the pre-registration inbox for “You're on the FastAmps Connect list!”.
2. If missing, note DNS/`no-reply@connect.fastamps.com` dependency — OTP email may still arrive via Base44.

## C. Invitation QR (synthetic)

1. Admin → **Programmes** → Invitation QR for Links Electrical.
2. Scan / open `https://connect.fastamps.com/invite/links-electrical-shrewsbury`.
3. While programme is draft: message should say not active + offer pre-register.
4. Confirm invitation does **not** unlock claim rewards by itself.

## D. Charger registration (QA only)

1. Use an existing QA/demo charger sticker or Admin Beta test charger — not genuine manufacturing stock.
2. Active installer account only.
3. Scan QR or enter serial + PIN.
4. Confirm wholesaler **and** exact branch are required.
5. Capture/upload serial + install photos.
6. Submit → appears in Admin → Review installs.
7. Approve/reject as usual; confirm earnings rules unchanged (£10 install, 3-install first redemption).

## E. Pre-registered claim block

1. Using a pre-registered account, attempt Register install / claim API path.
2. Expect block / interest-list messaging — no live reward claim.

## F. Payout hold

1. Admin → Vouchers: confirm genuine Giftbit live UK send remains unavailable / held.
2. QA/demo rows stay excluded from commercial reporting unless “Include demo / excluded QA” is checked.

## G. When Edd-authorised codes arrive

1. Follow `GENUINE_CODE_IMPORT_INSTRUCTIONS.md`.
2. Admin → QR batches → validate → import → export stickers.
3. Allocate to Links Electrical / Shrewsbury.
4. Complete another manual claim using a **synthetic** path first if needed; only use genuine stickers after JP authorises field use.
5. Admin → Programmes → Activate **only** after JP explicit approval.
6. Pause immediately from the same screen if a real-world issue appears.
