import { createClientFromRequest } from "npm:@base44/sdk";

const normaliseSerial = (value) => String(value || "").trim().toUpperCase();
const normalisePin = (value) => String(value || "").trim();
const OPAQUE_TOKEN = /^[a-f0-9]{32}$/i;
const SIX_DIGIT_PIN = /^\d{6}$/;

export default async function(req) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const claimToken = String(body.claim_token || "").trim();
    const suppliedSerial = normaliseSerial(body.serial_number);
    const suppliedPin = normalisePin(body.pin_code);
    if (claimToken.length > 128 || suppliedSerial.length > 120 || suppliedPin.length > 6) {
      return Response.json({ error: "Invalid charger reference." }, { status: 400 });
    }
    // A general website address is not a charger label and carries no reference.
    if (claimToken.includes("://") || claimToken.includes(" ")) {
      return Response.json({ error: "That QR code is a website link, not a charger label. Scan the QR printed on the charger, or sign in and enter its serial number and PIN." }, { status: 400 });
    }
    // Retired trade-show shortcut: never auto-resolve TRADE-SHOW-01 / demo stands.
    // Accept boolean or stringy truthy values in case a client/wrapper coerces JSON.
    const tradeShowRequested = body.trade_show === true || body.trade_show === "true" || body.trade_show === 1;
    if (tradeShowRequested && !claimToken && !suppliedSerial) {
      return Response.json({
        error: "That code opens the FastAmps Connect website only. Scan a charger label QR, or enter the charger's serial number and PIN.",
      }, { status: 400 });
    }
    const signedIn = await base44.auth.isAuthenticated();
    const user = signedIn ? await base44.auth.me() : null;

    // The current label carries an unguessable QR reference. Older labels put
    // the serial number and PIN in the link instead, and that pair is the proof:
    // both are printed on the physical label, so neither is guessed from the web.
    const tokenIsQr = OPAQUE_TOKEN.test(claimToken);
    const serialRef = suppliedSerial || (claimToken && !tokenIsQr ? normaliseSerial(claimToken) : "");
    const pinRef = suppliedPin;
    const pairSupplied = Boolean(serialRef) && SIX_DIGIT_PIN.test(pinRef);

    if (!user?.email && !tokenIsQr && !pairSupplied) {
      return Response.json({ error: "Scan a current charger QR code, or sign in to enter its serial number and PIN." }, { status: 401 });
    }

    if (!tokenIsQr && !serialRef) {
      return Response.json({ error: "Enter both the charger serial number and six-digit PIN." }, { status: 400 });
    }
    if (!tokenIsQr && !SIX_DIGIT_PIN.test(pinRef)) {
      return Response.json({ error: "Enter the six-digit charger PIN, including any leading zeros." }, { status: 400 });
    }

    // An opaque QR reference resolves to the charger it was printed for.
    // A serial reference is ALWAYS checked together with its PIN.
    const lookup = tokenIsQr
      ? { claim_token: claimToken }
      : { serial_number: serialRef };
    const matches = await base44.asServiceRole.entities.Charger.filter(lookup, "-created_date", 2);

    if (matches.length !== 1) {
      return Response.json({
        error: matches.length > 1
          ? "Duplicate charger records need checking by FastAmps. Please contact support."
          : "This charger could not be found in the FastAmps register. Check its serial number and PIN.",
      }, { status: matches.length > 1 ? 409 : 404 });
    }
    const charger = matches[0];
    if (charger.qr_generated === false) {
      return Response.json({ error: "This charger has been saved in the FastAmps register but is not yet activated for installer claims." }, { status: 409 });
    }
    if (!tokenIsQr && normalisePin(charger.pin_code) !== pinRef) {
      return Response.json({ error: "The serial number and PIN do not match. Please check the physical charger label." }, { status: 404 });
    }

    // A serial number, not a six-digit PIN, is the physical charger's identity.
    const sameSerial = await base44.asServiceRole.entities.Charger.filter({ serial_number: charger.serial_number });
    if (sameSerial.length !== 1) {
      return Response.json({ error: "Duplicate serial numbers exist in the charger register. Contact FastAmps." }, { status: 409 });
    }

    // Ordinary duplicate-claim protection for every charger, including any
    // historical TRADE-SHOW rows that remain in the register.
    const previousClaims = await base44.asServiceRole.entities.InstallClaim.filter({ serial_number: charger.serial_number });
    if (previousClaims.length || charger.claim_status !== "available" || charger.install_claim_id) {
      return Response.json({ error: "A warranty and reward claim has already been submitted for this charger." }, { status: 409 });
    }

    const isDemo = charger.is_demo === true
      || String(charger.batch_reference || "").toUpperCase().startsWith("TRADE-SHOW")
      || String(charger.batch_reference || "").startsWith("HOME-BETA");

    // Anonymous claim-gate callers only need enough to continue into auth.
    // PIN stays off the unauthenticated response; signed-in resolve still
    // returns it so the installer submission form can be pre-filled.
    const publicCharger = {
      claim_token: charger.claim_token,
      serial_number: charger.serial_number,
      product_model: charger.product_model || "Alpha 7",
      claim_status: charger.claim_status,
      is_demo: isDemo,
    };
    if (user?.email) {
      publicCharger.pin_code = charger.pin_code;
    }

    return Response.json({
      success: true,
      charger: publicCharger,
    });
  } catch (error) {
    console.error("resolve-charger-claim failed", error);
    return Response.json({ error: "The charger could not be verified. Please try again.", code: "charger-entry-v2" }, { status: 500 });
  }
}
