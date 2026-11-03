import { createClientFromRequest } from "npm:@base44/sdk";

const MINIMUM_REDEMPTION_AMOUNT = 30;
const FIRST_REDEMPTION_INSTALLS = 3;
const REFERRAL_CREDIT_VALUE = 20;

function isReferralCreditToken(value) {
  return String(value || "").startsWith("referral-credit-");
}

const PENDING_CODES = new Set([
  "INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED",
  "INFO_CAMPAIGN_CREATED_FUNDS_PENDING",
]);

function providerConfig() {
  const mode = (Deno.env.get("GIFTBIT_MODE") || "manual").toLowerCase();
  const token = Deno.env.get("GIFTBIT_API_TOKEN");
  const templateId = Deno.env.get("GIFTBIT_TEMPLATE_ID");
  const fallback = mode === "testbed"
    ? "https://api-testbed.giftbit.com/papi/v1"
    : "https://api.giftbit.com/papi/v1";
  return {
    mode,
    token,
    templateId,
    apiBaseUrl: (Deno.env.get("GIFTBIT_API_BASE_URL") || fallback).replace(/\/$/, ""),
  };
}

function giftbitHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept-Encoding": "identity",
  };
}

function providerCode(payload, response) {
  return payload?.campaign?.status || payload?.info?.code || payload?.code || payload?.status || `http_${response.status}`;
}

function providerMessage(payload) {
  return payload?.error?.message || payload?.info?.message || payload?.message || "Giftbit did not complete the request.";
}

async function markRewardsIssued(base44, voucherRequest, actionedBy = "Voucher process") {
  const rewardParts = voucherRequest.claim_ids || [];
  const referralCreditUnits = rewardParts.filter(isReferralCreditToken).length;
  for (const claimId of rewardParts.filter((value) => !isReferralCreditToken(value))) {
    await base44.asServiceRole.entities.InstallClaim.update(claimId, { reward_status: "issued" });
  }
  if (voucherRequest.includes_welcome_reward || referralCreditUnits > 0) {
    const installers = await base44.asServiceRole.entities.Installer.filter({
      user_email: voucherRequest.installer_email,
    });
    if (installers[0]) {
      await base44.asServiceRole.entities.Installer.update(installers[0].id, {
        ...(voucherRequest.includes_welcome_reward ? { welcome_reward_status: "issued" } : {}),
        ...(referralCreditUnits > 0 ? {
          referral_discounts_redeemed: Number(installers[0].referral_discounts_redeemed || 0) + referralCreditUnits,
          referral_discount_last_redeemed_at: new Date().toISOString(),
          referral_discount_last_redeemed_by: actionedBy,
        } : {}),
      });
    }
  }
}

function isSentState(code) {
  const value = String(code || "").toUpperCase();
  return value === "INFO_CAMPAIGN_CREATED" ||
    value.includes("SENT") ||
    value.includes("DELIVERED") ||
    value.includes("COMPLETED");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  try {
    const admin = await base44.auth.me();
    if (!admin?.email || admin.role !== "admin") {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { request_id, action } = await req.json();
    if (!request_id || !["refresh", "send", "manual_sent"].includes(action)) {
      return Response.json({ error: "Choose a valid voucher action." }, { status: 400 });
    }

    const voucherRequest = await base44.asServiceRole.entities.VoucherRequest.get(request_id);
    if (!voucherRequest) {
      return Response.json({ error: "Voucher request not found." }, { status: 404 });
    }
    if (voucherRequest.status === "sent") {
      return Response.json({ success: true, status: "sent", message: "This reward has already been marked as sent." });
    }
    if (["send", "manual_sent"].includes(action)) {
      if (voucherRequest.fraud_review_status === "held") {
        return Response.json({ error: "Voucher fulfilment is on fraud-review hold. Release the hold with an audit reason first." }, { status: 409 });
      }
      const profile = (await base44.asServiceRole.entities.Installer.filter({ user_email: voucherRequest.installer_email }))[0];
      if (!profile || ["held", "blocked"].includes(profile.reward_account_status)) {
        return Response.json({ error: "Installer reward account is held or blocked. No voucher may be issued." }, { status: 409 });
      }
      if (profile.programme_terms_version !== "2026-10-v1" || !profile.programme_terms_accepted_at) {
        return Response.json({ error: "Installer must accept the current programme terms before any reward can be issued." }, { status: 409 });
      }
    }

    const installerRequests = await base44.asServiceRole.entities.VoucherRequest.filter({
      installer_email: voucherRequest.installer_email,
    });
    const hasPreviousCompletedRedemption = installerRequests.some((item) =>
      item.id !== voucherRequest.id && !item.excluded_from_reporting && item.status === "sent"
    );
    if (["send", "manual_sent"].includes(action)) {
      const currentTokens = new Set(voucherRequest.claim_ids || []);
      const overlaps = installerRequests.some((item) => {
        if (item.id === voucherRequest.id || item.excluded_from_reporting ||
          !["requested", "processing", "sent"].includes(item.status)) return false;
        if (item.includes_welcome_reward && voucherRequest.includes_welcome_reward) return true;
        return (item.claim_ids || []).some((token) => currentTokens.has(token));
      });
      if (overlaps) {
        return Response.json({ error: "An overlapping voucher request already exists for this installer. Investigate and resolve the duplicate before issuing any reward." }, { status: 409 });
      }
    }
    if (!hasPreviousCompletedRedemption) {
      const approvedInstalls = await base44.asServiceRole.entities.InstallClaim.filter({
        installer_email: voucherRequest.installer_email,
        status: "approved",
      });
      const uniqueApprovedInstallCount = new Set(
        approvedInstalls
          .filter((claim) => !claim.excluded_from_reporting && !claim.is_demo && !["held", "rejected"].includes(claim.reward_status) && claim.install_photo_url && claim.serial_photo_url)
          .map((claim) => String(claim.serial_number || "").trim().toUpperCase())
          .filter(Boolean),
      ).size;
      if (uniqueApprovedInstallCount < FIRST_REDEMPTION_INSTALLS) {
        return Response.json({
          error: `The installer needs three unique approved installations before their first voucher can be sent. They currently have ${uniqueApprovedInstallCount}.`,
        }, { status: 400 });
      }
    }

    if (["send", "manual_sent"].includes(action)) {
      const rewardParts = voucherRequest.claim_ids || [];
      const referralCreditTokens = rewardParts.filter(isReferralCreditToken);
      const claimRecords = [];
      for (const claimId of rewardParts.filter((value) => !isReferralCreditToken(value))) {
        const claim = await base44.asServiceRole.entities.InstallClaim.get(claimId);
        if (!claim || claim.excluded_from_reporting || claim.is_demo || claim.status !== "approved" ||
            !claim.serial_photo_url || !claim.install_photo_url ||
            !["redemption_requested", "approved"].includes(claim.reward_status) ||
            claim.installer_email !== voucherRequest.installer_email) {
          return Response.json({ error: "A claimed installation is held, lacks required photo evidence or is otherwise ineligible for payout." }, { status: 400 });
        }
        const charger = claim.charger_record_id
          ? await base44.asServiceRole.entities.Charger.get(claim.charger_record_id) : null;
        if (!charger || String(charger.serial_number || "").trim().toUpperCase() !== String(claim.serial_number || "").trim().toUpperCase()
          || String(charger.pin_code || "").trim() !== String(claim.pin_code || "").trim()
          || charger.qr_generated === false) {
          return Response.json({ error: "This installation is not linked to a valid matching charger register record. Hold payout and investigate." }, { status: 409 });
        }
        const sameSerialClaims = await base44.asServiceRole.entities.InstallClaim.filter({ serial_number: claim.serial_number });
        if (sameSerialClaims.some((other) => other.id !== claim.id && !other.is_demo &&
          !other.excluded_from_reporting && other.status === "approved")) {
          return Response.json({ error: "Multiple approved installation claims exist for one charger serial number. Payout is blocked." }, { status: 409 });
        }
        claimRecords.push(claim);
      }
      const uniquePayoutSerials = new Set(claimRecords.map((claim) => String(claim.serial_number || "").trim().toUpperCase()).filter(Boolean));
      if (uniquePayoutSerials.size !== claimRecords.length) {
        return Response.json({ error: "This voucher includes overlapping rewards for the same charger serial number." }, { status: 409 });
      }

      const installers = await base44.asServiceRole.entities.Installer.filter({
        user_email: voucherRequest.installer_email,
      });
      const installer = installers[0];
      if (!installer || referralCreditTokens.some((token) => !String(token).startsWith(`referral-credit-${installer.id}-`))) {
        return Response.json({ error: "This voucher contains referral credit for a different installer." }, { status: 400 });
      }
      if (referralCreditTokens.length > 0) {
        const direct = await base44.asServiceRole.entities.Installer.filter({ referred_by_installer_id: installer.id });
        const linkedByCode = installer.referral_code
          ? await base44.asServiceRole.entities.Installer.filter({ referred_by_code: installer.referral_code }) : [];
        const uniqueReferrals = [...new Map([...direct, ...linkedByCode]
          .filter((item) => item.referred_by_installer_id === installer.id ||
            (!item.referred_by_installer_id && item.referred_by_code === installer.referral_code))
          .map((item) => [item.id, item])).values()];
        const qualifyingReferrals = uniqueReferrals.filter((item) => item.referral_qualified && !item.is_demo &&
          !item.excluded_from_reporting && (!item.referral_review_status || item.referral_review_status === "clear"));
        const qualifyingCounts = await Promise.all(qualifyingReferrals.map(async (item) => {
          const priorClaims = await base44.asServiceRole.entities.InstallClaim.filter({ installer_email: item.user_email, status: "approved" });
          return new Set(priorClaims.filter((claim) => !claim.is_demo && !claim.excluded_from_reporting
            && !["held", "rejected"].includes(claim.reward_status) && claim.serial_photo_url && claim.install_photo_url)
            .map((claim) => String(claim.serial_number || "").trim().toUpperCase()).filter(Boolean)).size;
        }));
        const validQualified = qualifyingCounts.filter((count) => count >= 5).length;
        const claimedReferralUnits = Number(installer.referral_discounts_redeemed || 0) + referralCreditTokens.length;
        if (uniqueReferrals.some((item) => item.referral_qualified && ["held", "rejected"].includes(item.referral_review_status))
          || claimedReferralUnits > validQualified) {
          return Response.json({ error: "Referral credits in this voucher require further fraud and eligibility review." }, { status: 409 });
        }
      }

      const expectedAmount = claimRecords.reduce((sum, claim) => sum + Number(claim.reward_amount || 0), 0)
        + (voucherRequest.includes_welcome_reward ? Number(installer.welcome_reward_amount || 10) : 0)
        + (referralCreditTokens.length * REFERRAL_CREDIT_VALUE);
      if (Math.round(expectedAmount * 100) !== Math.round(Number(voucherRequest.amount) * 100)) {
        return Response.json({
          error: `Voucher total mismatch. The eligible rewards total £${expectedAmount.toLocaleString("en-GB")}.`,
        }, { status: 400 });
      }
      if (expectedAmount < MINIMUM_REDEMPTION_AMOUNT) {
        return Response.json({
          error: `This reward totals £${expectedAmount.toLocaleString("en-GB")}. The minimum voucher claim is £${MINIMUM_REDEMPTION_AMOUNT}.`,
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const audit = {
      last_checked_date: now,
      actioned_by_email: admin.email,
      actioned_by_name: admin.full_name || admin.email,
      actioned_at: now,
    };

    if (action === "manual_sent") {
      await markRewardsIssued(base44, voucherRequest, admin.email);
      const updated = await base44.asServiceRole.entities.VoucherRequest.update(request_id, {
        ...audit,
        status: "sent",
        sent_date: now,
        fulfilment_provider: "manual",
        provider_status: "manual_sent_by_admin",
        provider_error: null,
      });
      return Response.json({ success: true, status: "sent", request: updated, message: "Reward recorded as sent manually." });
    }

    const config = providerConfig();
    if (!config.token || !config.templateId || !["testbed", "live"].includes(config.mode)) {
      return Response.json({ error: "Giftbit is not fully configured." }, { status: 503 });
    }

    let response;
    let payload;

    if (action === "refresh") {
      if (!voucherRequest.provider_order_id) {
        return Response.json({ error: "This request has no Giftbit campaign reference." }, { status: 400 });
      }
      response = await fetch(
        `${config.apiBaseUrl}/campaign/${encodeURIComponent(voucherRequest.provider_order_id)}`,
        { headers: giftbitHeaders(config.token) },
      );
      payload = await response.json().catch(() => ({}));
    } else {
      if (!["requested", "failed"].includes(voucherRequest.status)) {
        return Response.json({
          error: "This Giftbit campaign is already processing. Check its status instead of sending a duplicate.",
        }, { status: 409 });
      }
      const parts = String(voucherRequest.installer_name || "").trim().split(/\s+/).filter(Boolean);
      const firstname = parts.shift() || "Installer";
      const lastname = parts.join(" ");
      const orderId = voucherRequest.provider_order_id || `fastamps-voucher-${voucherRequest.id}`;

      response = await fetch(`${config.apiBaseUrl}/campaign`, {
        method: "POST",
        headers: giftbitHeaders(config.token),
        body: JSON.stringify({
          gift_template: config.templateId,
          contacts: [{
            firstname,
            ...(lastname ? { lastname } : {}),
            email: voucherRequest.installer_email,
          }],
          price_in_cents: Math.round(Number(voucherRequest.amount) * 100),
          id: orderId,
        }),
      });
      payload = await response.json().catch(() => ({}));
    }

    const code = providerCode(payload, response);
    const awaitingFunds = PENDING_CODES.has(payload?.info?.code) || code === "AWAITING_FUNDS";
    if (awaitingFunds) {
      const testbedGbpMessage = config.mode === "testbed" && Number(voucherRequest.amount) > 0
        ? "Giftbit Testbed is holding this GBP campaign because its virtual balance is only available in supported test currencies. This does not mean the live UK integration is unfunded."
        : "Giftbit accepted the campaign, but it is waiting for available account funds. Do not resend it.";
      const updated = await base44.asServiceRole.entities.VoucherRequest.update(request_id, {
        ...audit,
        status: "processing",
        fulfilment_provider: "giftbit",
        provider_environment: config.mode,
        provider_status: "AWAITING_FUNDS",
        provider_error: testbedGbpMessage,
      });
      return Response.json({
        success: true,
        status: "processing",
        request: updated,
        message: testbedGbpMessage,
      });
    }

    if (response.ok && code === "API_CREATING") {
      const updated = await base44.asServiceRole.entities.VoucherRequest.update(request_id, {
        ...audit,
        status: "processing",
        fulfilment_provider: "giftbit",
        provider_environment: config.mode,
        provider_status: "API_CREATING",
        provider_error: "Giftbit is creating the reward. Check again shortly.",
      });
      return Response.json({
        success: true,
        status: "processing",
        request: updated,
        message: "Giftbit is creating the reward. Check again shortly.",
      });
    }

    if (response.ok && isSentState(code)) {
      await markRewardsIssued(base44, voucherRequest, admin.email);
      const updated = await base44.asServiceRole.entities.VoucherRequest.update(request_id, {
        ...audit,
        status: "sent",
        sent_date: now,
        fulfilment_provider: "giftbit",
        provider_environment: config.mode,
        provider_status: code,
        provider_error: null,
      });
      return Response.json({
        success: true,
        status: "sent",
        request: updated,
        message: `Giftbit has accepted the £${Number(voucherRequest.amount).toLocaleString("en-GB")} campaign for ${voucherRequest.installer_email}.`,
      });
    }

    const message = providerMessage(payload);
    await base44.asServiceRole.entities.VoucherRequest.update(request_id, {
      ...audit,
      status: action === "refresh" ? voucherRequest.status : "failed",
      provider_status: code,
      provider_error: message,
    });
    return Response.json({ error: message, provider_status: code }, { status: response.ok ? 409 : 502 });
  } catch (error) {
    console.error("admin-voucher-action failed", error);
    return Response.json({ error: error?.message || "The voucher action could not be completed." }, { status: 500 });
  }
});