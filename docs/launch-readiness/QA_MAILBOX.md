# QA mailbox plan (Gmail plus-aliases)

## Findings (23 Nov 2026)

- Connect/`auth/register` **accepts Gmail plus-aliases** and returns distinct user ids (two probe registrations succeeded at the API layer and triggered OTP emails).
- Completing verification still requires the real OTP from email — no security bypass.
- Existing production logins are **not** suitable as the 20 synthetic installers.

## Preferred approach

1. One **dedicated** Gmail (or Google Workspace) inbox for Connect QA only.
2. Register installers as `{local}+qa-launch-2026-installer01@gmail.com` … `…installer20@…`.
3. Retrieve OTPs via **read-only IMAP** using a Google **App Password** (2SV required). Never use a personal mailbox password.

Secrets (Cursor environment — not chat):

- `CONNECT_QA_GMAIL_ADDRESS` — base inbox
- `CONNECT_QA_GMAIL_APP_PASSWORD` — App Password for IMAP

## Fallback if plus-aliases fail in practice

- Google Workspace / custom domain **catch-all** to one inbox, or
- Pre-invite 20 users from admin and complete first login with OTP to the same catch-all.

## Safety

- All synthetic identities / companies / batches keep `QA-LAUNCH-2026`.
- Claims marked `is_demo=true`, `demo_label=QA-LAUNCH-2026`, `excluded_from_reporting=true`, `reward_status=held` so they cannot drive Giftbit or programme totals.
- No further production deploys without explicit approval.
