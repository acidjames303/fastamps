import { createClientFromRequest } from "npm:@base44/sdk";

const validActions: Record<string, string[]> = {
  installer: ["hold", "release", "block"],
  referral: ["hold", "release", "reject"],
  installation: ["hold", "release", "reject"],
  voucher: ["hold", "release"],
};

export default async function (req) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const db = createClientFromRequest(req);
  try {
    const admin = await db.auth.me();
    if (!admin?.email || admin.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });

    const body = await req.json();
    const scope = String(body.scope || "");
    const targetId = String(body.target_id || "").trim();
    const action = String(body.action || "");
    const reason = String(body.reason || "").trim();
    if (!targetId || !validActions[scope]?.includes(action) || reason.length < 8 || reason.length > 1000) {
      return Response.json({ error: "Select a valid review action and provide a reason of 8 to 1,000 characters." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const actor = { by: admin.email, at: now };
    let warning = "";
    let updated: any;

    if (scope === "installer") {
      const record = await db.asServiceRole.entities.Installer.get(targetId);
      if (!record) return Response.json({ error: "Installer not found." }, { status: 404 });
      updated = await db.asServiceRole.entities.Installer.update(targetId, {
        reward_account_status: action === "hold" ? "held" : action === "block" ? "blocked" : "active",
        reward_account_reason: reason,
        reward_account_review_by: actor.by, reward_account_review_at: actor.at,
      });
    } else if (scope === "referral") {
      const referred = await db.asServiceRole.entities.Installer.get(targetId);
      if (!referred?.referred_by_installer_id) return Response.json({ error: "This installer is not linked to a referrer." }, { status: 404 });
      updated = await db.asServiceRole.entities.Installer.update(targetId, {
        referral_review_status: action === "release" ? "clear" : action === "hold" ? "held" : "rejected",
        referral_review_reason: reason,
        referral_review_by: actor.by, referral_review_at: actor.at,
      });
      if (referred.referral_qualified && action !== "release") {
        // Previously awarded credits may already be in a queued or sent voucher.
        // Never decrement ambiguous balances or claim a gift card can be recalled.
        const referrer = await db.asServiceRole.entities.Installer.get(referred.referred_by_installer_id);
        if (referrer && referrer.reward_account_status !== "blocked") {
          await db.asServiceRole.entities.Installer.update(referrer.id, {
            reward_account_status: "held",
            reward_account_reason: `Previously qualified referral ${referred.id} placed under review: ${reason}`,
            reward_account_review_by: actor.by, reward_account_review_at: actor.at,
          });
          warning = "The referrer's wallet has also been held because this referral may already have earned a credit. Review any existing voucher requests manually before releasing it.";
        }
      }
      if (action === "release" && !referred.referral_qualified) {
        const referrer = await db.asServiceRole.entities.Installer.get(referred.referred_by_installer_id);
        if (referrer && !["held", "blocked"].includes(referrer.reward_account_status)) {
          const eligibleClaims = await db.asServiceRole.entities.InstallClaim.filter({
            installer_email: referred.user_email, status: "approved",
          });
          const approved = new Set(eligibleClaims.filter((claim) =>
            !claim.is_demo && !claim.excluded_from_reporting &&
            !["held", "rejected"].includes(claim.reward_status) && claim.serial_photo_url && claim.install_photo_url
          ).map((claim) => String(claim.serial_number || "").trim().toUpperCase()).filter(Boolean)).size;
          if (approved >= 5) {
            // Atomic qualify gate — concurrent release/sync cannot double-credit.
            const qualify = await db.asServiceRole.entities.Installer.updateMany(
              { id: referred.id, referral_qualified: false },
              { $set: { referral_qualified: true, referral_qualified_at: now } },
            );
            if (Number(qualify?.updated) === 1) {
              await db.asServiceRole.entities.Installer.updateMany(
                { id: referrer.id },
                {
                  $inc: { qualified_referrals: 1, referral_discounts_available: 1 },
                  $set: { referral_discount_last_awarded_at: now },
                },
              );
              warning = "Five eligible installations were already approved, so the £20 referral credit has now been added. Check any other wallet holds separately.";
            } else {
              warning = "Referral was already qualified by a concurrent process; no additional credit was added.";
            }
          }
        }
      }
      // Releasing the referral does not lift a separately placed wallet hold.
    } else if (scope === "installation") {
      const claim = await db.asServiceRole.entities.InstallClaim.get(targetId);
      if (!claim) return Response.json({ error: "Install claim not found." }, { status: 404 });
      const paid = ["issued", "redemption_requested"].includes(claim.reward_status);
      if (paid) {
        const matches = await db.asServiceRole.entities.Installer.filter({ user_email: claim.installer_email });
        const installer = matches[0];
        if (installer) {
          await db.asServiceRole.entities.Installer.update(installer.id, {
            reward_account_status: "held", reward_account_reason: `Dispute on previously requested/issued claim ${claim.id}: ${reason}`,
            reward_account_review_by: actor.by, reward_account_review_at: actor.at,
          });
        }
        warning = "The wallet was placed on hold. This reward has already been requested or issued, so it cannot be automatically reversed.";
      } else {
        updated = await db.asServiceRole.entities.InstallClaim.update(targetId, {
          reward_status: action === "release" ? (claim.status === "approved" ? "approved" : "pending")
            : action === "hold" ? "held" : "rejected",
          reward_review_reason: reason,
          reward_review_by: actor.by, reward_review_at: actor.at,
        });
      }
      // Warranty registration remains unchanged. Referral qualification is independently
      // rechecked at redemption; any previously qualified/referral credits require review.
      const candidate = (await db.asServiceRole.entities.Installer.filter({ user_email: claim.installer_email }))[0];
      if (candidate?.referred_by_installer_id && candidate.referral_qualified && action !== "release") {
        const referrer = await db.asServiceRole.entities.Installer.get(candidate.referred_by_installer_id);
        if (referrer && referrer.reward_account_status !== "blocked") {
          await db.asServiceRole.entities.Installer.update(referrer.id, {
            reward_account_status: "held",
            reward_account_reason: `Previously qualified referral's installation ${claim.id} is disputed: ${reason}`,
            reward_account_review_by: actor.by, reward_account_review_at: actor.at,
          });
        }
        warning += " Related referrer's wallet placed on hold for review.";
      }
    } else if (scope === "voucher") {
      const voucher = await db.asServiceRole.entities.VoucherRequest.get(targetId);
      if (!voucher) return Response.json({ error: "Voucher request not found." }, { status: 404 });
      if (voucher.status === "sent") return Response.json({ error: "Already sent vouchers cannot be held or recalled. Hold the installer account to prevent future claims." }, { status: 409 });
      updated = await db.asServiceRole.entities.VoucherRequest.update(targetId, {
        fraud_review_status: action === "hold" ? "held" : "clear",
        fraud_review_reason: reason,
        fraud_review_by: actor.by, fraud_review_at: actor.at,
      });
      if (voucher.status === "processing" && action === "hold") warning = "This Giftbit order may already have been accepted. Check provider status directly; a hold in FastAmps cannot recall or cancel it.";
    }

    await db.asServiceRole.entities.RewardReviewAudit.create({
      scope, target_id: targetId, action, reason,
      reviewer_email: admin.email,
      reviewer_name: admin.full_name || admin.email,
      reviewed_at: now,
    });

    return Response.json({ success: true, updated, warning, message: `${scope} ${action} saved with a review audit entry.` });
  } catch (err) {
    console.error("admin-fraud-review error", err);
    return Response.json({ error: "Could not save this review. No voucher was deliberately issued." }, { status: 500 });
  }
}
