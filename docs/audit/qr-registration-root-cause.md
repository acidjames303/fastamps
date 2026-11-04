# FastAmps Connect — QR Registration Root-Cause Audit (Phase 1)

**Date:** 2026-11-03 (Europe/London)  
**Production:** https://connect.fastamps.com  
**Beta label:** https://connect-test.fastamps.com  
**Base44 app id (production bundle):** `6adf6de7ebdb4cb382e8779f`  
**Git checkpoint branch:** `cursor/repair-qr-registration-flow-2436`  
**Source availability:** GitHub `acidjames303/fastamps` contains only `README.md`. Live source lives in Base44; eject blocked until Base44 auth is available. This audit is based on the published production frontend bundle (`/assets/index-pyfitg7S.js`) plus anonymous API probes.

---

## Executive verdict

The production installer journey still exists (claim route, resolve function, photo submit, admin QR labels), but **trade-show / demo shortcuts are woven into the same claim path**. That conflates a static website QR with charger claim QR behaviour, can auto-resolve a shared `TRADE-SHOW-01` charger when `?demo=1` is present without a claim token, and hardcodes claim URLs to the production domain. Beta (`connect-test`) currently serves the Base44 editor login shell, not an isolated published Connect test app — so beta QR isolation cannot be trusted until that environment is corrected.

**Do not delete production chargers, claims, or installer accounts.** Historical `TRADE-SHOW` records should be archived/flagged, not destroyed.

---

## What still works (preserve)

| Area | Evidence in production bundle |
|---|---|
| Unique claim URLs | `dp(token) => https://connect.fastamps.com/claim/{token}` |
| Label QR generation | Uses `claim_token` only (`dp(rt.claim_token)`); PIN stays on the printed label, not in the QR payload |
| Claim entry route | `/claim/:claimToken` |
| Manual serial + PIN | `resolve-charger-claim` with `{serial_number, pin_code}` |
| Auth returnTo | Login/register links use `?returnTo=` including claim path; claim page builds returnTo from pathname (+ `?demo=1` for trade-show) |
| Install evidence | `submit-install-claim-v2` with serial + install photo URLs |
| Camera denial recovery | Scanner maps `NotAllowedError` to “Allow camera… or upload a photo of the QR” |
| Admin charger import / QR download | `import-charger-batch`, `mark-qr-downloads`, fixed-label renderer |

Backend functions referenced by the frontend:

`resolve-charger-claim`, `submit-install-claim-v2`, `import-charger-batch`, `mark-qr-downloads`, `retire-chargers`, `register-installer`, plus admin/voucher helpers.

---

## Regressions and unwanted trade-show behaviour

### R1 — Trade-show charger auto-provision (Admin Beta Test)

**Where:** Admin Beta Test UI (`/admin/beta-test`)  
**What:** “Create tradeshow charger” calls:

```text
import-charger-batch({
  action: "import",
  single: true,
  is_demo: true,
  demo_label: "TRADE-SHOW",
  batch_reference: "TRADE-SHOW",
  qr_generated: true,
  rows: [{ serial_number: "TRADE-SHOW-01", pin_code: <random 6 digit>, product_model: "Alpha 7" }]
})
```

**Impact:** Stand workflow depends on a special shared charger, not a static website QR to `https://connect.fastamps.com`.

### R2 — `?demo=1` / `trade_show` claim resolution without a token

**Where:** Install / claim entry logic (minified SubmitInstall / ChargerClaimEntry path)

```text
demo = URLSearchParams(...).get("demo") === "1"
resolve-charger-claim({ claim_token: token, trade_show: !token && demo })
```

**Impact:** Opening a demo URL **without** a unique claim token asks the backend to resolve via `trade_show: true`. That is the likely path that auto-binds visitors to `TRADE-SHOW-01` / trade-show claim logic instead of only opening the public site.

Also: unauthenticated claim gate appends `?demo=1` to `returnTo` when `charger.is_trade_show` is true, keeping the special path alive across register/login.

### R3 — Trade-show QR helper is not a static website QR

**Where:** app URL helpers (equivalent of `src/lib/appUrl.js`)

```text
LU = "https://connect.fastamps.com"
dp = token => `${LU}/claim/${encodeURIComponent(token)}`
YR = token => `${dp(token)}?demo=1`   // trade-show / demo claim URL
```

Admin Beta Test “Tradeshow QR” is described as opening the stand charger with serial/PIN filled automatically and allowing many visitors to register; claims marked `TRADE-SHOW` / never paid.

**Required behaviour:** trade-show printed QR must be **only** `https://connect.fastamps.com` (no `/claim/...`, no `?demo=1`, no auto claim).

### R4 — Hardcoded production claim host

**Where:** same helpers  
**Impact:** All generated claim/label URLs use `https://connect.fastamps.com` regardless of environment. There is **no** `connect-test.fastamps.com` reference in the production bundle. Beta QR generation, if run from this codebase shape, would send scanners into production.

### R5 — Beta host is not an isolated Connect runtime

**Observation:** `https://connect-test.fastamps.com` redirects unauthenticated users to `/login` and serves a Base44 **platform/editor** shell (Monaco workers, workspace auth), titled “FastAmps Connect Test”, not the installer PWA asset graph used by production (`/assets/index-*.js`).

**Impact:** Phase 8 “isolated beta regression” cannot run against this hostname as-is. Need a published test app (or correct custom domain binding) with its own database, and claim URLs that resolve only there.

### R6 — Auth post-login destination can drop `/claim/...`

**Where:** helper equivalent to `authReturnTo` / safe return path:

```text
ud(path, isAdmin) {
  if (path.startsWith("/claim/")) return isAdmin ? null : "/register-install";
  ...
}
```

**Impact:** After authentication, a pending `/claim/{token}` returnTo may be rewritten to `/register-install`, losing the specific charger token unless another store (session/query) rehydrates it. This matches the reported “dashboard / generic install entry replaces pending claim” class of bugs. Must be verified against full source once ejected; likely needs preserving claim token through auth and landing back on `/claim/{token}` (or an equivalent authenticated claim continuation).

### R7 — PIN still shown on public claim gate

Unauthenticated `/claim/:token` success UI displays model, serial, and **PIN** before register/login. Token resolution is intentional; unnecessary anonymous PIN exposure should be reduced where safe (Phase 7), without breaking label verification for signed-in installers.

### R8 — “Use tradeshow test charger” scanner shortcut

Exact string not present in the current production bundle (may already have been renamed/removed or only exists in beta/editor source). Admin Beta still exposes tradeshow setup + demo QR cards. Scanner still supports camera + upload and maps permission denial helpfully. Confirm after eject that no remaining shortcut injects `TRADE-SHOW-01` / `?demo=1`.

---

## QR classification (required separation)

| Class | Intended behaviour | Current risk |
|---|---|---|
| **A. Static website QR** | Open `https://connect.fastamps.com` only | Trade-show flow uses claim/`?demo=1` instead |
| **B. Charger claim QR** | `/claim/{uniqueToken}` → one charger | Works when token valid; demo flags contaminate path |
| **C. Legacy serial/PIN QR** | Validated legacy format → resolve | Manual serial/PIN path still present; confirm legacy payload parser after eject |
| **D. Invalid QR** | Clear error, no record | Anonymous invalid token returns: “Scan a current charger QR code…” — good; ensure no side-effect create |

---

## Model recognition (Phase 6 preview)

No client-side visual model-recognition / image-match function names appear in the production bundle. Charger model comes from the charger record via `resolve-charger-claim`. **Automatic visual model verification does not appear implemented in the published app.** Preserve evidence upload + admin review; do not fabricate AI match results.

---

## Security / incentive notes (Phase 7 preview)

- Trade-show claims are marked never-paid in UI copy; server must remain source of truth (`is_demo` / `TRADE-SHOW` exclusion from voucher payout). Verify in `submit-install-claim-v2` / voucher functions after eject.
- Duplicate real-charger claims must stay blocked server-side; do not weaken RLS to fix navigation.
- Claim tokens appear to be the QR secret; keep PIN out of newly generated QR payloads (already the case in label generator).
- Concurrent duplicate reward races need server-side uniqueness checks (inspect claim functions).

---

## Files to patch once source is available

Exact paths named in the brief (confirm after `base44 eject`):

- `src/lib/appUrl.js` — remove hardcoded-only prod assumptions carefully; remove `createTradeShowUrl` / `?demo=1` helper; static site URL vs claim URL
- `src/lib/qrPayload.js` — classify A/B/C/D; drop trade-show parsing
- `src/lib/authReturnTo.js` — preserve `/claim/{token}` across login/register/OAuth/refresh
- `src/components/QrScanner.jsx` / `QrViewer.jsx` — remove tradeshow shortcut; keep camera/upload
- `src/pages/AdminBetaTest.jsx` — remove tradeshow charger creation UI/workflow; keep legitimate beta chargers
- `src/pages/AdminChargers.jsx` — preserve fixed-label QR generation
- `src/pages/ChargerClaimEntry.jsx` / `SubmitInstall.jsx` — stop `trade_show` resolution without token; restore photo submit path
- `src/pages/Register.jsx` / `Login.jsx` / `App.jsx` — returnTo + route guards
- `base44/functions/resolve-charger-claim/entry.ts` — remove trade-show auto-assign; keep serial/PIN + token resolve; no anonymous create
- `base44/functions/submit-install-claim-v2/entry.ts` — duplicate protection; demo never payable
- `base44/functions/import-charger-batch/entry.ts` — stop TRADE-SHOW-01 special case if present; keep normal import

---

## Blockers before Phase 2+ patches

1. **Source not in GitHub.** Need either:
   - Base44 login / `BASE44_ACCESS_TOKEN` (+ refresh) or `BASE44_API_KEY` to run `base44 eject --app-id 6adf6de7ebdb4cb382e8779f -y`, or
   - Full project push to `github.com/acidjames303/fastamps`.
2. **Beta environment isolation.** `connect-test.fastamps.com` must publish a Connect test build with its own DB and claim base URL — not the Base44 editor login shell.
3. **Device login pending:** verification code issued for eject (see agent follow-up); regenerate if expired.

---

## Backup / fixture plan (non-destructive)

- Git branch checkpoint: `cursor/repair-qr-registration-flow-2436` (this doc).
- After eject: commit unmodified ejected tree as `checkpoint/pre-qr-repair` tag or first commit on branch before edits.
- Fixture dataset (beta only): fake chargers with unique `claim_token`, demo flag clear for “real” beta chargers, separate `is_demo` chargers; fake installers; non-payable claims. **No production deletes.**
- Archive rule for existing `batch_reference=TRADE-SHOW` / `TRADE-SHOW-01`: leave records; stop generating new special trade-show claim QRs; optionally mark retired in admin without destroying history.

---

## Next step

Complete Base44 auth or source push → eject → re-verify this audit against real files → surgical Phase 2–9 patches and beta tests only.
