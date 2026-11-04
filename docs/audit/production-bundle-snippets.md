# Production bundle evidence snippets

Captured from `https://connect.fastamps.com/assets/index-pyfitg7S.js` on 2026-11-03 (Europe/London). Minified identifiers preserved.

## App identity

- Default `appId`: `6adf6de7ebdb4cb382e8779f`
- Media public path also references workspace/app assets under `6ab11d37ba4cf09ddd77f163`

## Claim / demo URL helpers

```js
const LU="https://connect.fastamps.com",
  dp=e=>`${LU}/claim/${encodeURIComponent(e)}`,
  Rfe=`${LU}/register-install`,
  YR=e=>`${dp(e)}?demo=1`;
```

## Trade-show import

```js
Xe.functions.invoke("import-charger-batch",{
  action:"import",
  single:!0,
  is_demo:!0,
  demo_label:"TRADE-SHOW",
  batch_reference:"TRADE-SHOW",
  qr_generated:!0,
  rows:[{serial_number:"TRADE-SHOW-01",pin_code:fj(),product_model:"Alpha 7"}]
})
```

## Resolve with trade_show flag

```js
const t = claimTokenFromRoute;
const r = new URLSearchParams(window.location.search).get("demo")==="1";
await Xe.functions.invoke("resolve-charger-claim",{
  claim_token:t,
  trade_show:!t&&r
});
```

## Auth returnTo sanitisation (risk)

```js
function ud(e,t){
  return e.startsWith("/claim/")
    ? (t ? null : "/register-install")
    : ((t?Fne:Dne).includes(e) || (!t && e==="/register-install") ? e : null);
}
```

## Label QR uses claim_token only

```js
const nt=dp(rt.claim_token);
await _A({claimUrl:nt,serialNumber:rt.serial_number,pinCode:rt.pin_code,...});
```

## Anonymous resolve probe

`POST .../functions/resolve-charger-claim` with `{claim_token:"test"}` →

```json
{"error":"Scan a current charger QR code, or sign in to enter its serial number and PIN."}
```

## Routes present

`/login`, `/register`, `/forgot-password`, `/reset-password`, `/claim/:claimToken`, `/register-install`, `/installs`, `/admin/installs`, `/admin/installers`, `/admin/chargers`, `/admin/reports`, `/admin/vouchers`, `/admin/fraud-review`, `/admin/beta-test`, `/admin/qa`, `/opportunities`, `/earnings`, `/academy`, `/leaderboard`, `/profile`, `/programme-terms`, `/coach`
