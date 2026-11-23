# Wholesaler company + branch validation

Updated: 2026-11-23 (Europe/London)

## Requirement

Every installation claim must record:

1. Wholesaler company (e.g. Links Electrical / CEF)
2. Exact branch or town (e.g. Shrewsbury)

## Evidence

| Layer | Status | Notes |
| --- | --- | --- |
| Installer UI | Present | Labels `Wholesaler company *` / `Wholesaler branch or town *`; client-side required + submit guard |
| Prefill | Present | From nominated wholesaler/branch; installer may change per claim |
| Live `submit-install-claim-v2` | **Pass (API)** | After production `POST /deploy`, empty/whitespace company or branch → **400** with clear error |
| Browser step-2 | **Pass** | Deep link `QA-LAUNCH-2026-S00008`; labels exact; prefill working; empty submit blocked; no claim created |
| Live SPA strings | Pass | `Wholesaler company *`, `Wholesaler branch or town *`, prefill hint present in `index-Dqk2xKAX.js` |

## Critical publish lesson

Updating `PUT /backend-functions/...` or `coding/redeploy-function` alone **did not** change the live `/functions/submit-install-claim-v2` runtime. Production invoke only picked up the guard after **`POST /api/apps/{id}/deploy`**.

`deploy-dist` publishes the SPA only and must be re-run after a full deploy if the SPA was overwritten.

## Probe hygiene

During diagnosis, several QA serials (`QA-LAUNCH-2026-S00016`–`S00020`, `S00006`–`S00007`) received blank-wholesaler claims before the guard was live. Those claims were marked `is_demo`, `excluded_from_reporting`, `reward_status=held`.
