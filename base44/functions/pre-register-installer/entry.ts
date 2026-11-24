import { createClientFromRequest } from "npm:@base44/sdk";

const PRIVACY_VERSION = "2026-11-v1";

const normalizeUkMobile = (value: unknown) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0044")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("44")) digits = `0${digits.slice(2)}`;
  return digits.slice(0, 11);
};

const normalizePostcode = (value: unknown) => {
  const compact = String(value || "").toUpperCase().replace(/\s+/g, "");
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};

async function generateUniqueCode(base44: any) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `FA-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const existing = await base44.asServiceRole.entities.Installer.filter({ referral_code: code });
    if (!existing.length) return code;
  }
  throw new Error("A unique referral code could not be generated.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Please verify your email and sign in before completing pre-registration." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const fullName = String(body.full_name || `${firstName} ${lastName}`).trim().replace(/\s+/g, " ");
    const businessName = String(body.business_name || "").trim();
    const mobile = normalizeUkMobile(body.mobile);
    const townCity = String(body.town_city || "").trim();
    const postcode = normalizePostcode(body.postcode);
    const coverageArea = String(body.coverage_area || "").trim();
    const wholesaler = String(body.nominated_wholesaler || body.preferred_wholesaler || "").trim();
    const branch = String(body.nominated_branch || body.preferred_branch || "").trim();
    const manualWholesaler = String(body.preferred_wholesaler_manual || "").trim();
    const manualBranch = String(body.preferred_branch_manual || "").trim();
    const notify = body.notify_programme_availability !== false;
    const attributedProgrammeCode = String(body.attributed_programme_code || "").trim().toLowerCase();

    if (fullName.length < 2) {
      return Response.json({ error: "Enter your first and last name." }, { status: 400 });
    }
    if (!businessName) {
      return Response.json({ error: "Enter your business name." }, { status: 400 });
    }
    if (!/^07\d{9}$/.test(mobile)) {
      return Response.json({ error: "Enter a valid UK mobile number beginning with 07 or +44 7." }, { status: 400 });
    }
    if (!townCity) {
      return Response.json({ error: "Enter your town or city." }, { status: 400 });
    }
    if (!/^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/.test(postcode)) {
      return Response.json({ error: "Enter a valid UK postcode, for example SY1 1AA." }, { status: 400 });
    }
    if (!coverageArea) {
      return Response.json({ error: "Describe your primary installation coverage area." }, { status: 400 });
    }

    const resolvedWholesaler = wholesaler || manualWholesaler;
    const resolvedBranch = branch || manualBranch;
    if (!resolvedWholesaler || !resolvedBranch) {
      return Response.json({
        error: "Select your preferred wholesaler and exact branch, or enter them manually for administrator review.",
      }, { status: 400 });
    }
    if (body.privacy_accepted !== true) {
      return Response.json({ error: "Please accept the privacy notice to continue." }, { status: 400 });
    }

    const existingProfiles = await base44.asServiceRole.entities.Installer.filter({ user_email: user.email });
    if (existingProfiles.length) {
      const existing = existingProfiles[0];
      if (existing.membership_status === "pre_registered" || existing.membership_status === "invited") {
        return Response.json({
          success: true,
          already_registered: true,
          profile: existing,
          message: "You are already on the FastAmps Connect interest list for this account.",
        });
      }
      return Response.json({
        error: "An installer profile already exists for this account. Sign in to continue, or contact FastAmps if you need help.",
        existing_membership_status: existing.membership_status || "active",
      }, { status: 409 });
    }

    const duplicateMobile = await base44.asServiceRole.entities.Installer.filter({ mobile });
    if (duplicateMobile.some((candidate) => !candidate.excluded_from_reporting)) {
      return Response.json({
        error: "This mobile number is already associated with an installer account. Contact FastAmps if you need to recover access.",
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const referralCode = await generateUniqueCode(base44);
    const profile = await base44.asServiceRole.entities.Installer.create({
      mobile,
      full_name: fullName,
      business_name: businessName,
      region: coverageArea,
      town_city: townCity,
      postcode,
      coverage_area: coverageArea,
      nominated_wholesaler: resolvedWholesaler,
      nominated_branch: resolvedBranch,
      preferred_wholesaler_manual: manualWholesaler,
      preferred_branch_manual: manualBranch,
      user_email: user.email,
      tier: "New",
      referrals: 0,
      referral_code: referralCode,
      membership_status: "pre_registered",
      reward_account_status: "held",
      reward_account_reason: "Pre-registered — awaiting programme eligibility. Not an active incentive member.",
      referral_review_status: "clear",
      welcome_reward_amount: 10,
      welcome_reward_status: "deferred",
      notify_programme_availability: notify,
      privacy_terms_version: PRIVACY_VERSION,
      privacy_accepted_at: now,
      pre_registered_at: now,
      attributed_programme_code: attributedProgrammeCode || "",
      programme_terms_version: "",
      // No programme terms acceptance and no redeemable welcome bonus until activation.
    });

    // Confirmation email uses Base44 Core email when available. Failures are logged, not fatal.
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        from_name: "FastAmps Connect",
        subject: "You're on the FastAmps Connect list!",
        body: [
          `Hi ${firstName || fullName.split(" ")[0] || "there"},`,
          "",
          "Thank you for registering your interest in FastAmps Connect.",
          "",
          "We're gradually introducing our installer rewards programme across the UK. We'll notify you when the programme becomes available through your preferred wholesaler or in your area.",
          "",
          `Preferred wholesaler: ${resolvedWholesaler} – ${resolvedBranch}`,
          "",
          "You're on the list — no further action is needed right now.",
          "",
          "FastAmps Connect",
          "https://connect.fastamps.com",
        ].join("\n"),
      });
    } catch (emailError) {
      console.error("pre-register confirmation email failed", emailError);
    }

    return Response.json({
      success: true,
      profile,
      confirmation: {
        heading: "You're on the list!",
        message: "Thank you for registering your interest in FastAmps Connect. We're gradually introducing our installer rewards programme across the UK. We'll notify you when the programme becomes available through your preferred wholesaler or in your area.",
      },
    });
  } catch (error) {
    console.error("pre-register-installer failed", error);
    return Response.json({ error: error?.message || "We could not complete your pre-registration." }, { status: 500 });
  }
});
