# FastAmps Connect — security baseline (2026-11-26)

Production: https://connect.fastamps.com  
Status: baseline reviewed; continuous intrusion analytics **NOT ACTIVE** until log export/SIEM wired.

## Enforced today (verified)

| Control | Where enforced | Evidence |
| --- | --- | --- |
| HTTPS + HSTS | Hosting/Cloudflare | Response headers on `/` |
| X-Frame-Options DENY | Hosting | Response headers |
| X-Content-Type-Options nosniff | Hosting | Response headers |
| Admin UI gate | `AdminRoute` | Frontend only — insufficient alone |
| Admin API gate | Server `user.role === "admin"` | `admin-voucher-action`, `import-charger-batch`, `manage-incentive-programme`, etc. |
| Anonymous admin/claim blocked | Backend functions | `ops:security-smoke` |
| Invalid login rejected | Base44 auth | Health/security smoke |
| Installer cannot call admin voucher action | Backend role check | Security smoke (when installer secrets present) |
| Live Giftbit fulfilment blocked | `request-voucher*` + admin action | Code + Testbed mode |
| Genuine Links inactive | IncentiveProgramme `draft` | Public invite `active:false` |
| Pre-reg cannot claim | Membership fail-closed | Claim submitters |
| Homepage `Cache-Control: private, no-store` | Hosting | Limits HTML staleness; hashed assets cached 7d |

## Gaps / platform-owned

| Gap | Risk | Status |
| --- | --- | --- |
| Auth brute-force / credential stuffing controls | Account takeover | **Platform (Base44)** — not configurable in this repo; confirm in Base44 dashboard |
| Custom WAF rules | Automated abuse | Cloudflare present; project rules **NOT VERIFIED** |
| Continuous failed-login analytics | Late detection | **NOT ACTIVE** — needs log export or SIEM |
| Dependency CVEs (`npm audit`) | Supply chain | Weekly workflow reports; triage required |
| QA cohort password rotation | Credential reuse | **BLOCKED** without Base44 password API |
| Anonymous function calls return HTTP 500 | Confusing clients / monitoring | Platform quirk — body says Authentication required; prefer 401 if Base44 allows |

## Incident response (summary)

1. Capture evidence (no secrets in tickets).  
2. Contain with existing controls (disable live Giftbit already; hold reward accounts; keep Links draft).  
3. Alert JP via ops-alert GitHub issue / webhook when configured.  
4. Smallest safe fix → test → `deploy-preserve` → `ops:verify-release`.  
5. Record in `ops/maintenance-state.json` + deployment history.  

Never mass-disable all installers on an unconfirmed anomaly.  
Never claim the application is impossible to hack.
