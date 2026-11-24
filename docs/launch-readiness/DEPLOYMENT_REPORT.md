# Backend deployment report — create-time QA protections

Updated: 2026-11-24 (Europe/London)  
App: FastAmps Connect (`connect.fastamps.com`)  
Feature freeze: **in force**  
Giftbit live fulfilment: **still disabled**

## Decision for starting manual testing: **GO**

Backend create-time demo/QA protections are live and verified. Human manual testing has **not** been claimed as passed.

---

## Deployment

| Step | Result |
| --- | --- |
| Scope | Only approved create-time protections in `submit-install-claim-v2` + matching `submit-install-claim` |
| Excluded | Unrelated PR #10 / #12 product expansion; no reward-rule changes; no Giftbit live enablement |
| Unit/regression | `npm test` — **12/12 pass** |
| Redeploy functions | `coding/redeploy-function` for both claim submitters — **HTTP 200** |
| Publish functions | `POST /api/apps/{id}/deploy` — **HTTP 200** at 2026-11-24 09:49:47 UTC |
| SPA impact | Full deploy briefly overwrote frontend (`index-DRjqsHhC.js`) |
| SPA restore | `deploy-dist` of verified build — **HTTP 200** at 2026-11-24 09:50:10 UTC |
| Live frontend | **`assets/index-Dqk2xKAX.js`** restored (admin demo toggle, wholesaler labels, PIN hint, £10/£30) |

### Functions published

- `submit-install-claim-v2` — create-time `is_demo` + `excluded_from_reporting` + `reward_status=held` for demo/QA
- `submit-install-claim` — same create-time protections for parity

Live/non-demo claims remain `reward_status=pending`, not excluded.

### PR status

| PR | Action needed |
| --- | --- |
| #10 | Still open — harness/docs baseline; no further deploy required for this gate |
| #12 | Still open — SPA fixes already live via prior/`deploy-dist`; keep for git history merge |
| #13 | Contains create-time protection source + integrity docs — **backend already published**; merge when convenient for repo consistency |

---

## Verification

| Check | Result |
| --- | --- |
| Create-time protections (no harness patch) | **PASS** — claim `QA-LAUNCH-2026-W2-S00049` / `6b055deda0cf111067a7855b`: `is_demo=true`, `excluded_from_reporting=true`, `reward_status=held`, label `QA-LAUNCH-2026` |
| QA voucher path | Excluded installers cannot raise a live wallet claim (`request-voucher-v2` treats excluded profiles as unavailable) |
| Genuine live claims preserved | 3 live FA-BETA claims unchanged; `reward_amount=10`; not forced to held |
| Wholesaler blank/whitespace | Live API **400** |
| SPA GBP | £10 / £30 present; `$10` count **0** |
| Admin include demo/excluded | Present in live bundle |
| PIN hint / `/earnings` | Present |
| Smoke | **PASS**, publish blockers `[]` |
| QA reconcile | **PASS** — 0 unprotected QA claims / 0 reporting leaks |
| Giftbit auto UK payout | **Disabled** — readiness `liveSendingEnabled=false`, mode testbed/manual path |

Artifacts:

- `/opt/cursor/artifacts/verify-create-time-protections.json`
- `/opt/cursor/artifacts/post-deploy-smoke.json`
- `/opt/cursor/artifacts/reconcile-qa-dataset-post-deploy.json`

---

## Manual testing

Ready checklist: `docs/launch-readiness/MANUAL_TESTING_HANDOVER.md`

Use **demo/QA chargers only**. Do not consume Links/customer FA-BETA stock for exploratory tests unless FastAmps explicitly assigns those codes.

---

## Final decision

**GO for beginning human manual testing** on the live V1 app.

Still **CONDITIONAL GO** for full Links Electrical beta operations until:

1. Manual installer + admin checklist completed on real phones  
2. Live UK Giftbit funding/permissions confirmed before any auto-send enablement  
3. 200 printed Links labels spot-checked
