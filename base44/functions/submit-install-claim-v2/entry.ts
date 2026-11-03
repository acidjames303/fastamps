import { createClientFromRequest } from "npm:@base44/sdk";

const normaliseSerial = (value) => String(value || "").trim().toUpperCase();
const normalisePin = (value) => String(value || "").trim();
const looksLikeImageUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const photoLocationFields = (body: Record<string, unknown>, prefix: string) => {
  const latitude = Number(body[`${prefix}_latitude`]);
  const longitude = Number(body[`${prefix}_longitude`]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  const accuracy = Number(body[`${prefix}_location_accuracy`]);
  return {
    [`${prefix}_latitude`]: latitude,
    [`${prefix}_longitude`]: longitude,
    [`${prefix}_location_accuracy`]: Number.isFinite(accuracy) ? accuracy : null,
    [`${prefix}_location_source`]: String(body[`${prefix}_location_source`] || "").trim() === "exif" ? "exif" : "device",
    [`${prefix}_location_captured_at`]: String(body[`${prefix}_location_captured_at`] || "").trim() || new Date().toISOString(),
  };
};

export default async function (req) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: "Please sign in before submitting an installation." }, { status: 401 });

    const body = await req.json();
    const claimToken = String(body.claim_token || "").trim();
    const serialNumber = normaliseSerial(body.serial_number);
    const pinCode = normalisePin(body.pin_code);
    if (!claimToken || !serialNumber || !pinCode) {
      return Response.json({ error: "Verify a charger serial number and PIN before submitting." }, { status: 400 });
    }
    if (!looksLikeImageUrl(body.serial_photo_url) || !looksLikeImageUrl(body.install_photo_url)) {
      return Response.json({ error: "Two installation photos are required: the physical serial-number label and the fitted charger." }, { status: 400 });
    }
    if (!body.install_date || !body.site_postcode || body.consent_confirmed !== true) {
      return Response.json({ error: "Please complete the installation details and confirmation." }, { status: 400 });
    }

    const compactPostcode = String(body.site_postcode).toUpperCase().replace(/\s+/g, "");
    const formattedPostcode = compactPostcode.length > 3
      ? `${compactPostcode.slice(0, -3)} ${compactPostcode.slice(-3)}`
      : compactPostcode;
    if (!/^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/.test(formattedPostcode)) {
      return Response.json({ error: "Enter a valid UK postcode, for example NG1 1AA." }, { status: 400 });
    }

    let verifiedPostcode = formattedPostcode;
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compactPostcode)}`);
      if (response.status === 404) return Response.json({ error: "That postcode was not found. Check it and try again." }, { status: 400 });
      if (!response.ok) return Response.json({ error: "We could not verify the postcode right now. Please try again." }, { status: 503 });
      const data = await response.json();
      verifiedPostcode = data?.result?.postcode || formattedPostcode;
    } catch {
      return Response.json({ error: "We could not verify the postcode right now. Please try again." }, { status: 503 });
    }

    const installers = await base44.entities.Installer.filter({ user_email: user.email });
    const installer = installers[0];
    if (!installer) return Response.json({ error: "Create your installer profile before submitting this claim." }, { status: 400 });

    const chargers = await base44.asServiceRole.entities.Charger.filter({ claim_token: claimToken });
    if (chargers.length !== 1) return Response.json({ error: "This charger reference is not uniquely recognised." }, { status: 409 });
    const charger = chargers[0];
    if (charger.qr_generated === false) {
      return Response.json({ error: "This charger has not yet been activated for installer claims." }, { status: 409 });
    }
    if (normaliseSerial(charger.serial_number) !== serialNumber || normalisePin(charger.pin_code) !== pinCode) {
      return Response.json({ error: "The charger serial number and PIN do not match the imported record." }, { status: 409 });
    }
    const sameSerial = await base44.asServiceRole.entities.Charger.filter({ serial_number: serialNumber });
    if (sameSerial.length !== 1) return Response.json({ error: "Duplicate serial records require FastAmps review." }, { status: 409 });

    // Historical TRADE-SHOW / HOME-BETA rows stay non-payable, but every charger
    // now uses the same one-claim atomic reserve (no multi-visitor stand bypass).
    const batchRef = String(charger.batch_reference || "");
    const isHistoricalTradeShow = batchRef.toUpperCase().startsWith("TRADE-SHOW");
    const isHomeBeta = batchRef.startsWith("HOME-BETA");
    const isDemoClaim = isHistoricalTradeShow || charger.is_demo === true || installer.is_demo === true || isHomeBeta;
    const demoLabel = isHistoricalTradeShow
      ? "TRADE-SHOW"
      : installer.is_demo === true
        ? (installer.demo_label || "BETA-DEMO")
        : (charger.is_demo || isHomeBeta)
          ? (charger.demo_label || (isHomeBeta ? "HOME-BETA" : "BETA-DEMO"))
          : "";

    // Concurrency-safe gate: only one caller can move available -> submitted.
    // Base44 documents this single-id updateMany pattern as atomic at write time.
    const reserve = await base44.asServiceRole.entities.Charger.updateMany(
      { id: charger.id, claim_status: "available" },
      { $set: { claim_status: "submitted" } },
    );
    if (Number(reserve?.updated) !== 1) {
      console.error("reserve failed", reserve);
      return Response.json({ error: "This charger has already been submitted for an installation reward.", security_stage: "1-atomic", reserve }, { status: 409 });
    }

    let claimCreated = false;
    try {
      const claim = await base44.asServiceRole.entities.InstallClaim.create({
        installer_email: user.email,
        installer_mobile: installer.mobile,
        installer_name: installer.full_name,
        product_model: charger.product_model || "Alpha 7",
        serial_number: charger.serial_number,
        pin_code: charger.pin_code,
        serial_photo_url: body.serial_photo_url,
        install_photo_url: body.install_photo_url,
        install_date: body.install_date,
        site_postcode: verifiedPostcode,
        wholesaler: String(body.wholesaler || "").trim(),
        wholesaler_branch: String(body.wholesaler_branch || "").trim(),
        consent_confirmed: true,
        status: "submitted",
        warranty_status: "queued",
        reward_amount: 10,
        reward_status: "pending",
        is_demo: isDemoClaim,
        demo_label: demoLabel,
        charger_record_id: charger.id,
        claim_reference: claimToken,
        ...photoLocationFields(body, "serial_photo"),
        ...photoLocationFields(body, "install_photo"),
      });
      claimCreated = true;
      try {
        await base44.asServiceRole.entities.Charger.update(charger.id, {
          claim_status: "submitted", install_claim_id: claim.id,
        });
      } catch (linkError) {
        console.error("Submitted claim needs charger linkage repair", claim.id, linkError);
      }
      return Response.json({
        success: true, claim,
        security_stage: "1-atomic",
        reserve_updated: Number(reserve?.updated ?? 0),
      });
    } catch (error) {
      if (!claimCreated) {
        // Best-effort release only if no claim was created for this serial.
        const currentClaims = await base44.asServiceRole.entities.InstallClaim.filter({ serial_number: serialNumber });
        if (!currentClaims.length) {
          await base44.asServiceRole.entities.Charger.updateMany(
            { id: charger.id, claim_status: "submitted" },
            { $set: { claim_status: "available", install_claim_id: "" } },
          );
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("submit-install-claim failed", error);
    return Response.json({ error: error?.message || "The installation could not be submitted." }, { status: 500 });
  }
}