import { createClientFromRequest } from "npm:@base44/sdk";

const MINIMUM_REDEMPTION_AMOUNT = 30;
const FIRST_REDEMPTION_INSTALLS = 3;
const REFERRAL_CREDIT_VALUE = 20;

/**
 * Design A (approved): create a redemption request for admin / manual fulfilment.
 * Claims are locked with per-row updateMany before the voucher row is created.
 * Base44 has no multi-record transaction: if voucher create fails after locks,
 * this function best-effort unlocks. Overlap checks include failed vouchers.
 */

const eligible = (claim: any) => claim.status === "approved" && claim.reward_status === "approved"
  && !claim.excluded_from_reporting && !claim.is_demo
  && Boolean(claim.serial_photo_url && claim.install_photo_url);
const uniqueCount = (claims: any[]) => new Set(claims.map((claim) => String(claim.serial_number || "").trim().toUpperCase()).filter(Boolean)).size;

async function unlockClaims(db: any, claimIds: string[]) {
  for (const id of claimIds) {
    try {
      await db.asServiceRole.entities.InstallClaim.updateMany(
        { id, reward_status: "redemption_requested" },
        { $set: { reward_status: "approved" } },
      );
    } catch (err) {
      console.error("unlockClaims failed", id, err);
    }
  }
}

export default async function (req) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const db = createClientFromRequest(req);
  const lockedClaimIds: string[] = [];
  let welcomeLocked = false;
  let referralUnitsLocked = 0;
  let installerId = "";
  try {
    const user = await db.auth.me();
    if (!user?.email) return Response.json({ error: "Sign in before requesting a voucher." }, { status: 401 });
    const installer = (await db.asServiceRole.entities.Installer.filter({ user_email: user.email }))[0];
    if (!installer || installer.excluded_from_reporting) return Response.json({ error: "Installer profile not found." }, { status: 404 });
    installerId = installer.id;
    if (["held", "blocked"].includes(installer.reward_account_status)) {
      return Response.json({ error: "Your rewards are under FastAmps review. Contact the team before requesting redemption." }, { status: 409 });
    }
    if (installer.programme_terms_version !== "2026-10-v1" || !installer.programme_terms_accepted_at) {
      return Response.json({ error: "Please accept the updated FastAmps programme terms in My Profile before redeeming rewards." }, { status: 409 });
    }

    const previous = await db.asServiceRole.entities.VoucherRequest.filter({ installer_email: user.email });
    // Include failed: those claims may still be locked or need admin release before a new request.
    const active = previous.find((item) => !item.excluded_from_reporting
      && ["requested", "processing", "failed"].includes(item.status));
    if (active) {
      return Response.json({ success: true, provider: active.fulfilment_provider, status: active.status,
        amount: active.amount, request: active,
        message: active.status === "failed"
          ? "A previous reward request failed during fulfilment. FastAmps must review it before another request."
          : "Your reward request is already waiting for FastAmps approval or provider fulfilment." });
    }

    const referredById = await db.asServiceRole.entities.Installer.filter({ referred_by_installer_id: installer.id });
    const referredByCode = installer.referral_code
      ? await db.asServiceRole.entities.Installer.filter({ referred_by_code: installer.referral_code }) : [];
    const referred = [...new Map([...referredById, ...referredByCode]
      .filter((item) => item.referred_by_installer_id === installer.id
        || (!item.referred_by_installer_id && item.referred_by_code === installer.referral_code))
      .map((item) => [item.id, item])).values()];
    if (referred.some((item) => item.referral_qualified && ["held", "rejected"].includes(item.referral_review_status))) {
      return Response.json({ error: "A previously qualified referral is under review. Please contact FastAmps before redeeming." }, { status: 409 });
    }

    const allApproved = await db.asServiceRole.entities.InstallClaim.filter({ installer_email: user.email, status: "approved" });
    const validInstallations = allApproved.filter((claim) => !claim.excluded_from_reporting && !claim.is_demo
      && !["rejected", "held"].includes(claim.reward_status)
      && Boolean(claim.install_photo_url && claim.serial_photo_url));
    const count = uniqueCount(validInstallations);
    const earlierSent = previous.some((item) => !item.excluded_from_reporting && item.status === "sent");
    if (!earlierSent && count < FIRST_REDEMPTION_INSTALLS) {
      return Response.json({ error: `Your first voucher requires three verified, unique approved installations. You currently have ${count}.` }, { status: 400 });
    }
    const approvedRewards = validInstallations.filter(eligible);
    if (uniqueCount(approvedRewards) !== approvedRewards.length) {
      return Response.json({ error: "Duplicate charger serial numbers were found in the available rewards. FastAmps must review them before redemption." }, { status: 409 });
    }
    const referralCreditUnits = Math.max(0, Math.floor(Number(installer.referral_discounts_available || 0)));
    const qualifyingCandidates = referred.filter((item) => item.referral_qualified && !item.excluded_from_reporting
      && !item.is_demo && (!item.referral_review_status || item.referral_review_status === "clear"));
    const qualifyingCounts = referralCreditUnits ? await Promise.all(qualifyingCandidates.map(async (item) => {
      const claims = await db.asServiceRole.entities.InstallClaim.filter({ installer_email: item.user_email, status: "approved" });
      return uniqueCount(claims.filter((claim) => !claim.is_demo && !claim.excluded_from_reporting &&
        !["held", "rejected"].includes(claim.reward_status) && claim.serial_photo_url && claim.install_photo_url));
    })) : [];
    const legitimatelyQualified = qualifyingCounts.filter((n) => n >= 5).length;
    if (referralCreditUnits > 0 && Number(installer.referral_discounts_redeemed || 0) + referralCreditUnits > legitimatelyQualified) {
      return Response.json({ error: "Referral credit requires FastAmps verification before it can be redeemed." }, { status: 409 });
    }

    // Lock each claim atomically; only successfully locked rows are included.
    for (const claim of approvedRewards) {
      const lock = await db.asServiceRole.entities.InstallClaim.updateMany(
        { id: claim.id, status: "approved", reward_status: "approved" },
        { $set: { reward_status: "redemption_requested" } },
      );
      if (Number(lock?.updated) === 1) lockedClaimIds.push(claim.id);
    }
    if (lockedClaimIds.length !== approvedRewards.length) {
      await unlockClaims(db, lockedClaimIds);
      return Response.json({ error: "Some rewards were claimed in another request. Refresh and try again." }, { status: 409 });
    }

    let includeWelcome = false;
    if (installer.welcome_reward_status === "available") {
      const welcomeLock = await db.asServiceRole.entities.Installer.updateMany(
        { id: installer.id, welcome_reward_status: "available" },
        { $set: { welcome_reward_status: "redemption_requested" } },
      );
      includeWelcome = Number(welcomeLock?.updated) === 1;
      welcomeLocked = includeWelcome;
    }

    if (referralCreditUnits > 0) {
      const referralLock = await db.asServiceRole.entities.Installer.updateMany(
        { id: installer.id, referral_discounts_available: referralCreditUnits },
        { $inc: { referral_discounts_available: -referralCreditUnits } },
      );
      if (Number(referralLock?.updated) !== 1) {
        await unlockClaims(db, lockedClaimIds);
        if (welcomeLocked) {
          await db.asServiceRole.entities.Installer.updateMany(
            { id: installer.id, welcome_reward_status: "redemption_requested" },
            { $set: { welcome_reward_status: "available" } },
          );
        }
        return Response.json({ error: "Referral credits changed during your request. Refresh and try again." }, { status: 409 });
      }
      referralUnitsLocked = referralCreditUnits;
    }

    const lockedClaims = approvedRewards.filter((c) => lockedClaimIds.includes(c.id));
    const amount = lockedClaims.reduce((sum, claim) => sum + Number(claim.reward_amount || 0), 0)
      + (includeWelcome ? Number(installer.welcome_reward_amount || 10) : 0)
      + referralUnitsLocked * REFERRAL_CREDIT_VALUE;
    if (!Number.isFinite(amount) || amount < MINIMUM_REDEMPTION_AMOUNT || Math.round(amount * 100) !== amount * 100) {
      await unlockClaims(db, lockedClaimIds);
      if (welcomeLocked) {
        await db.asServiceRole.entities.Installer.updateMany(
          { id: installer.id, welcome_reward_status: "redemption_requested" },
          { $set: { welcome_reward_status: "available" } },
        );
      }
      if (referralUnitsLocked > 0) {
        await db.asServiceRole.entities.Installer.updateMany(
          { id: installer.id },
          { $inc: { referral_discounts_available: referralUnitsLocked } },
        );
      }
      return Response.json({ error: `At least £${MINIMUM_REDEMPTION_AMOUNT} in approved, eligible rewards is required to request a voucher.` }, { status: 400 });
    }

    const referralTokens = Array.from({ length: referralUnitsLocked },
      (_, i) => `referral-credit-${installer.id}-${Number(installer.referral_discounts_redeemed || 0) + i + 1}`);
    const parts = [...lockedClaimIds, ...referralTokens];

    // Force manual/admin path when Giftbit is not explicitly testbed (Design A safety).
    const giftMode = (Deno.env.get("GIFTBIT_MODE") || "manual").toLowerCase();
    if (giftMode === "live") {
      await unlockClaims(db, lockedClaimIds);
      if (welcomeLocked) {
        await db.asServiceRole.entities.Installer.updateMany(
          { id: installer.id, welcome_reward_status: "redemption_requested" },
          { $set: { welcome_reward_status: "available" } },
        );
      }
      if (referralUnitsLocked > 0) {
        await db.asServiceRole.entities.Installer.updateMany(
          { id: installer.id },
          { $inc: { referral_discounts_available: referralUnitsLocked } },
        );
      }
      return Response.json({ error: "Live Giftbit fulfilment is disabled for this security release. Contact FastAmps." }, { status: 503 });
    }

    const request = await db.asServiceRole.entities.VoucherRequest.create({
      installer_email: user.email, installer_name: installer.full_name, installer_mobile: installer.mobile,
      claim_ids: parts, amount, eligible_approved_install_count: count,
      includes_welcome_reward: includeWelcome,
      fulfilment_provider: giftMode === "manual" ? "manual" : "giftbit",
      provider_environment: ["live", "testbed"].includes(giftMode) ? giftMode : "manual",
      provider_status: "awaiting_admin_fraud_review",
      provider_order_id: `fastamps-voucher-${crypto.randomUUID()}`,
      status: "requested", fraud_review_status: "clear", requested_date: new Date().toISOString(),
    });

    return Response.json({ success: true, status: "requested", request, amount, provider: "FastAmps", security_stage: "1-atomic",
      message: "Your voucher request is pending FastAmps fraud and eligibility review before fulfilment." });
  } catch (err) {
    console.error("request-voucher failed", err);
    await unlockClaims(db, lockedClaimIds);
    if (welcomeLocked && installerId) {
      try {
        await db.asServiceRole.entities.Installer.updateMany(
          { id: installerId, welcome_reward_status: "redemption_requested" },
          { $set: { welcome_reward_status: "available" } },
        );
      } catch {}
    }
    if (referralUnitsLocked > 0 && installerId) {
      try {
        await db.asServiceRole.entities.Installer.updateMany(
          { id: installerId },
          { $inc: { referral_discounts_available: referralUnitsLocked } },
        );
      } catch {}
    }
    return Response.json({ error: "Voucher request could not be completed. Contact FastAmps if your wallet does not update." }, { status: 500 });
  }
}
