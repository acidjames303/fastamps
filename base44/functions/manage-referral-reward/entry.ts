import { createClientFromRequest } from "npm:@base44/sdk";

const REQUIRED_APPROVED_INSTALLS = 5;
const REFERRAL_CREDIT_VALUE = 20;

export default async function (req) {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user?.email || user.role !== "admin") {
      return Response.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "sync");

    if (action === "redeem") {
      return Response.json({
        error: "Referral credit is redeemed from the installer's wallet through the normal voucher process.",
      }, { status: 400 });
    }

    const claimId = String(body.claim_id || "");
    if (!claimId) {
      return Response.json({ error: "Claim is required." }, { status: 400 });
    }

    const claim = await base44.asServiceRole.entities.InstallClaim.get(claimId);
    const installerProfiles = await base44.asServiceRole.entities.Installer.filter({
      user_email: claim.installer_email,
    });
    const referredInstaller = installerProfiles[0] || null;

    if (!referredInstaller?.referred_by_installer_id || !referredInstaller.referred_by_code) {
      return Response.json({ success: true, action: "not_referred" });
    }

    const claims = await base44.asServiceRole.entities.InstallClaim.filter({
      installer_email: referredInstaller.user_email,
      status: "approved",
    });
    const uniqueSerials = new Set(
      claims
        .filter((item) => !item.excluded_from_reporting && !item.is_demo && !["held", "rejected"].includes(item.reward_status) && item.serial_photo_url && item.install_photo_url)
        .map((item) => String(item.serial_number || "").trim().toUpperCase())
        .filter(Boolean),
    );
    const approvedInstallCount = uniqueSerials.size;

    if (referredInstaller.referral_review_status === "held" || referredInstaller.referral_review_status === "rejected") {
      return Response.json({ success: true, action: referredInstaller.referral_review_status,
        approved_install_count: approvedInstallCount, installs_remaining: Math.max(REQUIRED_APPROVED_INSTALLS - approvedInstallCount, 0) });
    }

    if (approvedInstallCount < REQUIRED_APPROVED_INSTALLS) {
      return Response.json({
        success: true,
        action: "pending",
        approved_install_count: approvedInstallCount,
        installs_remaining: Math.max(REQUIRED_APPROVED_INSTALLS - approvedInstallCount, 0),
      });
    }

    const referrer = await base44.asServiceRole.entities.Installer.get(
      referredInstaller.referred_by_installer_id,
    );
    if (!referrer || referrer.excluded_from_reporting) {
      return Response.json({ error: "The referring installer record could not be found." }, { status: 409 });
    }
    if (referrer.reward_account_status === "held" || referrer.reward_account_status === "blocked") {
      return Response.json({ success: true, action: "held",
        approved_install_count: approvedInstallCount, installs_remaining: 0,
        message: "Referral credit is paused pending FastAmps review." });
    }
    if (String(referrer.mobile || "") === String(referredInstaller.mobile || "") ||
      String(referrer.user_email || "").toLowerCase() === String(referredInstaller.user_email || "").toLowerCase()) {
      return Response.json({ error: "Self-referrals are not eligible for credit." }, { status: 409 });
    }

    const now = new Date().toISOString();

    // Atomic qualify gate: only the first concurrent caller wins.
    const qualify = await base44.asServiceRole.entities.Installer.updateMany(
      { id: referredInstaller.id, referral_qualified: false },
      { $set: { referral_qualified: true, referral_qualified_at: now } },
    );
    if (Number(qualify?.updated) !== 1) {
      return Response.json({
        success: true,
        action: "already_qualified", security_stage: "1-atomic",
        approved_install_count: approvedInstallCount,
        installs_remaining: 0,
      });
    }

    await base44.asServiceRole.entities.Installer.updateMany(
      { id: referrer.id },
      {
        $inc: { qualified_referrals: 1, referral_discounts_available: 1 },
        $set: { referral_discount_last_awarded_at: now },
      },
    );

    return Response.json({
      success: true,
      action: "qualified", security_stage: "1-atomic",
      approved_install_count: approvedInstallCount,
      reward: `£${REFERRAL_CREDIT_VALUE} voucher credit added to the referring installer's wallet`,
      referrer_id: referrer.id,
    });
  } catch (error) {
    console.error("manage-referral-reward failed", error);
    return Response.json({ error: error?.message || "The referral reward could not be updated." }, { status: 500 });
  }
}
