import { createClientFromRequest } from "npm:@base44/sdk";

const normalizeCode = (value: unknown) =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");

const normalizeUkMobile = (value: unknown) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0044")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("44")) digits = `0${digits.slice(2)}`;
  return digits.slice(0, 11);
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
      return Response.json({ error: "Please sign in before creating your installer profile." }, { status: 401 });
    }

    const existingProfiles = await base44.asServiceRole.entities.Installer.filter({ user_email: user.email });
    if (existingProfiles.length) {
      return Response.json({ error: "An installer profile already exists for this account." }, { status: 409 });
    }

    const body = await req.json();
    const fullName = String(body.full_name || "").trim();
    const mobile = normalizeUkMobile(body.mobile);
    const region = String(body.region || "").trim();
    const wholesaler = String(body.nominated_wholesaler || "").trim();
    if (fullName.length < 2 || !region || !wholesaler) {
      return Response.json({ error: "Complete all required installer details." }, { status: 400 });
    }
    if (!/^07\d{9}$/.test(mobile)) {
      return Response.json({ error: "Enter a valid UK mobile number beginning with 07 or +44 7." }, { status: 400 });
    }
    if (body.terms_accepted !== true || body.programme_terms_version !== "2026-10-v1") {
      return Response.json({ error: "Please read and accept the FastAmps installer and referral programme terms." }, { status: 400 });
    }
    const duplicateMobile = await base44.asServiceRole.entities.Installer.filter({ mobile });
    if (duplicateMobile.some((candidate) => !candidate.excluded_from_reporting)) {
      return Response.json({ error: "This mobile number is already associated with an installer account. Contact FastAmps if you need to recover access." }, { status: 409 });
    }

    const approvalDocuments = Array.isArray(body.approval_documents)
      ? body.approval_documents.map((value: unknown) => String(value || "").trim()).filter(Boolean).slice(0, 10)
      : [];
    const approvalDocumentNames = Array.isArray(body.approval_document_names)
      ? body.approval_document_names.map((value: unknown) => String(value || "").trim()).slice(0, approvalDocuments.length)
      : [];

    const referralCode = normalizeCode(body.referral_code);
    let referrer = null;
    if (referralCode) {
      const matches = await base44.asServiceRole.entities.Installer.filter({ referral_code: referralCode });
      referrer = matches[0] || null;
      if (!referrer || referrer.excluded_from_reporting) {
        return Response.json({ error: "That referral code was not recognised. Check it with the installer who referred you." }, { status: 400 });
      }
      if (String(referrer.user_email || "").toLowerCase() === String(user.email).toLowerCase() || normalizeUkMobile(referrer.mobile) === mobile) {
        return Response.json({ error: "You cannot refer yourself or register a second account using the same mobile number." }, { status: 400 });
      }
      if (referrer.reward_account_status === "blocked" || referrer.referral_review_status === "rejected") {
        return Response.json({ error: "This referral code is currently unavailable. Contact FastAmps." }, { status: 409 });
      }
    }

    const ownReferralCode = await generateUniqueCode(base44);
    const now = new Date().toISOString();
    const profile = await base44.asServiceRole.entities.Installer.create({
      mobile,
      full_name: fullName,
      business_name: String(body.business_name || "").trim(),
      region,
      nominated_wholesaler: wholesaler,
      nominated_branch: String(body.nominated_branch || "").trim(),
      user_email: user.email,
      tier: "New",
      referrals: 0,
      referral_code: ownReferralCode,
      programme_terms_version: "2026-10-v1",
      programme_terms_accepted_at: now,
      referral_terms_version: "2026-10-v1",
      referral_terms_accepted_at: now,
      reward_account_status: "active",
      referral_review_status: "clear",
      welcome_reward_amount: 10,
      welcome_reward_status: "available",
      ...(body.demo === true ? { is_demo: true, demo_label: "TRADE-SHOW" } : {}),
      approval_documents: approvalDocuments,
      approval_document_names: approvalDocumentNames,
      ...(approvalDocuments.length ? { approval_documents_submitted_at: now } : {}),
      ...(referrer ? {
        referred_by_installer_id: referrer.id,
        referred_by_code: referralCode,
        referred_by_name: referrer.full_name || referrer.user_email,
        referred_by_email: referrer.user_email,
        referred_at: now,
      } : {}),
    });

    if (referrer) {
      await base44.asServiceRole.entities.Installer.update(referrer.id, {
        referrals: Number(referrer.referrals || 0) + 1,
      });
    }

    return Response.json({
      success: true,
      profile,
      referral: referrer ? { name: referrer.full_name || referrer.user_email, code: referralCode } : null,
    });
  } catch (error) {
    console.error("register-installer failed", error);
    return Response.json({ error: error?.message || "We could not create your installer profile." }, { status: 500 });
  }
});