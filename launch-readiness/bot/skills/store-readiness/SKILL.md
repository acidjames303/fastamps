---
name: store-readiness
description: Assess Google Play and Apple App Store readiness versus mobile-web pilot readiness for FastAmps Connect.
---

# Store readiness

FastAmps Connect is a Base44 / PWA web application. A working website is **not** an approved native store app.

## Assess

- App identity, icons, branding (no third-party placeholder logos in the manifest).
- Privacy policy, terms, account deletion.
- Camera permission for QR / photo capture.
- Production API host (`connect.fastamps.com`).
- Crash / session recovery.
- Signing, certificates, developer accounts, TestFlight / Play internal testing.
- Listing screenshots and disclosure forms.

## Decisions

Report Android and iOS separately as Ready / Blocked / Pending Review.
Never claim the app is published or approved until verified in the store consoles.
If store publication cannot complete by the pilot dates, state clearly that the pilot can still launch as a mobile web app.
