# QA mailbox plan — Mailosaur

## Decision

Use **Mailosaur** for Connect registration OTP retrieval (not personal Gmail).

Addresses will look like:

`qa-launch-2026-installer01@{SERVER_ID}.mailosaur.net`

…through `installer20@…` — all land in one Mailosaur server inbox and are readable via API.

## Required secrets (Cursor environment — not chat)

| Secret | Purpose |
| --- | --- |
| `MAILOSAUR_API_KEY` | Read-only API access to search/fetch messages |
| `MAILOSAUR_SERVER_ID` | Server id used in `@{id}.mailosaur.net` |

Optional: `MAILOSAUR_API_BASE` (default `https://mailosaur.com/api`).

## Flow

1. Register installer with a unique Mailosaur address via genuine Base44 `auth/register`.
2. Poll Mailosaur for the OTP email to that address.
3. Complete Base44 `auth.verifyOtp` with the code.
4. Finish onboarding as `QA-LAUNCH-2026` synthetic installer.
5. Repeat for 20 accounts; then 20×20 installs under feature freeze.

## Safety

- No personal mailbox passwords.
- No auth bypass — real OTP from Mailosaur only.
- Claims remain `QA-LAUNCH-2026` / demo / excluded / held so Giftbit cannot fulfil them.
- No production deploys without explicit approval.
