---
name: installer-journey-audit
description: Audit the FastAmps Connect installer registration, claim, photo, and wallet journey without inventing features.
---

# Installer journey audit

Use against https://connect.fastamps.com and the local Base44 source.

## Checklist

1. Registration, email/mobile validation, duplicate mobile messaging.
2. Login, logout, session persistence, password reset.
3. Claim via charger QR (`/claim/{token}`) and manual serial + six-digit PIN.
4. Trade-show / website QR must open site home only — never auto-claim.
5. Two installation photos required; failed uploads must not approve rewards.
6. Duplicate or already-claimed serial rejected.
7. Wallet: welcome bonus and three-install first-redemption rules as currently configured.
8. Mobile layout at ~390px: no clipped CTAs, readable errors.

## Recording

For each finding call `record_issue`. Update area health with `update_health`.
Never create production installer accounts with real personal data unless the operator supplies dedicated pilot test credentials.
