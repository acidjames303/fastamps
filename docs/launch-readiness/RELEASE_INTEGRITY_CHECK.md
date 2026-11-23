# Release integrity check — Links Electrical beta

Updated: 2026-11-23 (Europe/London)  
Scope: controlled final check only (no new stress wave, no feature expansion)  
Feature freeze: **in force**

## Decision: **CONDITIONAL GO** (unchanged class)

Core product remains suitable for a bounded Shrewsbury beta. One **approved, undeployed** backend hardening item remains before create-time QA protections are live.

---

## 1. Immediate QA/demo protections at claim create

| Check | Result |
| --- | --- |
| Live `submit-install-claim-v2` today | Sets `is_demo` for demo/QA chargers/installers, but still creates `reward_status=pending` without `excluded_from_reporting` |
| Harness behaviour today | Post-create admin `PUT` patches `is_demo` + `excluded_from_reporting` + `reward_status=held` (gap window exists until patch) |
| Repo fix (this branch) | Demo/QA claims now create with **`held` + `excluded_from_reporting` + `is_demo`** immediately; live installers unchanged (`pending`, not excluded) |
| Unit proof | `tests/demoClaimProtections.test.mjs` PASS |
| Deployed? | **No** — requires approved Base44 function publish (`POST /deploy`) |

Genuine-photo E2E on live confirmed `created_protected: false` then successful harness patch. **Do not treat create-time protections as live until function deploy is approved and verified.**

---

## 2. QA dataset reconciliation (live read-only)

Artifact: `/opt/cursor/artifacts/reconcile-qa-dataset.json`

| Metric | Value |
| --- | --- |
| Claims total | 1815 |
| QA claims | 1812 |
| Live (non-QA) claims | 3 |
| QA installers | 50 / 54 |
| QA chargers | 1914 |
| Unprotected QA claims | **0** |
| QA claims still in reporting | **0** |
| QA claims with payable reward status | **0** |
| Live claims looking synthetic | **0** |
| Live vouchers at risk from QA emails | **0** |

Reporting/voucher code paths continue to skip `excluded_from_reporting` / `is_demo` / `held|rejected` rows (`get-programme-report`, `request-voucher`, `admin-voucher-action`).

---

## 3. Photograph evidence — classification

| Kind | Count / note |
| --- | --- |
| Stress-test synthetic URL (`apple-touch-icon`) | **3612** photo slots (capacity / association only) |
| Other HTTPS URLs | **12** (includes genuine-photo E2E uploads) |
| Missing photos | **0** on QA claims |

**Not claimed:** mass physical serial-label authenticity.

### Small genuine-image E2E (representative only)

| Step | Result |
| --- | --- |
| Upload distinct test JPEGs via Base44 `UploadFile` | PASS |
| Submit one available QA charger (`QA-LAUNCH-2026-W2-S00050`) | PASS |
| Protections after patch | `is_demo` + excluded + `held` |
| Admin API approve (reward remains held) | PASS |
| Admin browser review | PASS — claim found with Include demo/excluded; status Approved; Reward Held; QA-LAUNCH tag |

Artifacts: `/opt/cursor/artifacts/genuine-photo-e2e.json`, `/opt/cursor/artifacts/admin-claim-review/`

Note: test JPEGs are minimal synthetic files (may render as dark tiles). They prove **upload + association + admin retrieval**, not camera quality or physical label readability.

---

## 4. Concurrency documentation

Verified peak for Phase 11 W2 wave: **concurrency 25** (ramp 1 → 5 → 10 → 25).  
Result: **600 / 600** submits OK in **82s**; p50 **1353ms**; p95 **2063ms**.  
No additional peak-load test run for this integrity check.

Source: `docs/launch-readiness/STRESS_50x20_RESULTS.md`

---

## 5. PR #10 / PR #12 / deployed Base44 consistency

| Surface | State |
| --- | --- |
| Live SPA bundle | `index-Dqk2xKAX.js` |
| Live SPA GBP copy | £10 / £30 present; **$10 count = 0** |
| Live wholesaler UI strings | Present |
| Live admin include-demo toggle | Present in bundle |
| Live wholesaler API guard | PASS (empty company → 400) |
| PR #10 | Open (launch harness + earlier freeze-safe work) |
| PR #12 | Open (admin search/toggle + UX polish + docs) |
| This branch | Create-time demo protections + integrity docs/harness — **not deployed** |

### Safest release procedure (approval required — not executed)

1. Keep feature freeze; merge only freeze-safe PRs in stack order after human review.  
2. Publish backend functions with Base44 **`POST /deploy`** (includes `submit-install-claim-v2` create-time protections).  
3. Immediately re-run `deploy-dist` if SPA was overwritten.  
4. Smoke: empty wholesaler → 400; one QA claim → create-time `held`+excluded without harness patch; live GBP strings unchanged.  
5. Do **not** enable live Giftbit auto-send.

---

## 6. UK GBP rules + Giftbit posture

| Rule | Live status |
| --- | --- |
| £10 install reward / £10 welcome / £30 minimum / 3-install gate | Unchanged in live SPA |
| `reward_amount` on create | Still **10** (GBP programme) |
| Giftbit auto-send | Remains **disabled for live fulfilment** — keep manual/held ops |
| Existing non-QA voucher | One request `processing` / Giftbit **testbed** / `AWAITING_FUNDS` — confirms no completed live payout |

Documented ops stance: continue **manual / held** redemption until live UK GBP Giftbit funds + permissions are explicitly confirmed.

Agent env `GIFTBIT_MODE=Testbed` is for isolated probes only; production must stay non-live.

---

## 7. Links Electrical / 200-code batch preparation

Live register includes batch **`FastAmps_Beta_500_Codes_Ready`**:

| Check | Result |
| --- | --- |
| Count | 500 |
| Unique serials / PINs | 500 / 500 |
| PIN format | All 6-digit |
| `qr_generated` | 500 true |
| Available | 497 |
| Sample claim URL shape | `https://connect.fastamps.com/claim/{32-char-token}` |

Import path (`import-charger-batch`) enforces: full-register duplicate serial/PIN checks, in-file duplicates, batch-name collision, 6-digit PIN, rollback on failure. Local harness: `tests/chargerCsvImport.test.mjs` PASS (incl. 500 unique pilot CSV). QR payload classification: `tests/qrPayload.test.mjs` PASS.

**Beta ops recommendation:** select/print **200** labels from the ready unique register (or import a dedicated Links batch with the same validator), spot-check several printed QRs resolve to `/claim/{token}` on `connect.fastamps.com`, and keep unused codes unprinted or inventory-controlled. Do not re-import overlapping serials/PINs.

---

## Feature-freeze compliance

- No new product journeys, reward-rule changes, multi-currency UK wallets, or international features.  
- Only: create-time demo exclusion hardening, external QA reconcile/E2E harness, documentation.  
- **No merge/deploy performed without approval.**

---

## Final recommendation

**CONDITIONAL GO** for the Links Electrical Shrewsbury 200-charger beta.

Conditions:

1. Keep Giftbit fulfilment **manual/held** until live UK GBP funds/permissions confirmed.  
2. Keep QA/demo exclusion in reporting and admin default filters.  
3. **Approve and publish** `submit-install-claim-v2` create-time protections, then re-verify one QA claim is protected without a post-create patch.  
4. Print/activate only the intended 200 Links codes from the verified unique register; spot-check printed QRs.
