# QA mailbox plan — Mailosaur

## Decision

Use **Mailosaur** for Connect registration OTP retrieval (not personal Gmail).

Addresses will look like:

`qa-launch-2026-installer01@{SERVER_ID}.mailosaur.net`

…through `installer20@…` — all land in one Mailosaur server inbox and are readable via API.

## Status (2026-11-23)

**Connected.** Secrets are present in the Cloud Agent environment. Server id `8deitqir` resolved; 20 installers registered and OTP-verified end-to-end.

## Required secrets (Cursor environment — not chat)

| Secret | Purpose |
| --- | --- |
| `MAILOSAUR_SMTP_HOST` | Outgoing SMTP server from Mailosaur settings |
| `MAILOSAUR_SMTP_USER` | SMTP username |
| `MAILOSAUR_SMTP_PASSWORD` | SMTP password |
| `MAILOSAUR_SERVER_ID` | Server id used in `@{id}.mailosaur.net` |
| `MAILOSAUR_API_KEY` | Optional if separate from SMTP password; used to search/fetch OTP messages |

Optional: `MAILOSAUR_API_BASE` (default `https://mailosaur.com/api`).

Note: Base44 sends the OTP **to** Mailosaur. We do not need to send mail via SMTP for registration. SMTP credentials identify the account; OTP retrieval uses the Mailosaur Messages API (`MAILOSAUR_API_KEY`, or SMTP password when that is the API key).

## Flow

1. Register installer with a unique Mailosaur address via genuine Base44 `auth/register`.
2. Poll Mailosaur for the OTP email to that address (`npm run otp-mailosaur`).
3. Complete Base44 `auth/verify-otp` with the 6-digit code (`otp_code`).
4. Finish onboarding as `QA-LAUNCH-2026` synthetic installer (`register-installer` + admin demo/held flags).
5. Repeat for 20 accounts; then `npm run claim-wave` for 20×20 installs under feature freeze.

## Safety

- No personal mailbox passwords.
- No auth bypass — real OTP from Mailosaur only.
- Claims remain `QA-LAUNCH-2026` / demo / excluded / held so Giftbit cannot fulfil them.
- No production deploys without explicit approval.
