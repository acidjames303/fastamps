import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user?.email || user.role !== "admin") {
      return Response.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "activate");
    const installerId = String(body.installer_id || "").trim();
    if (!installerId) {
      return Response.json({ error: "installer_id is required." }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.Installer.filter({ id: installerId });
    const installer = matches[0];
    if (!installer) return Response.json({ error: "Installer not found." }, { status: 404 });

    const now = new Date().toISOString();

    if (action === "suspend") {
      const updated = await base44.asServiceRole.entities.Installer.update(installer.id, {
        membership_status: "suspended",
        reward_account_status: "blocked",
        reward_account_reason: String(body.reason || "Suspended by administrator."),
        reward_account_review_by: user.email,
        reward_account_review_at: now,
      });
      return Response.json({ success: true, profile: updated });
    }

    if (action === "invite") {
      const updated = await base44.asServiceRole.entities.Installer.update(installer.id, {
        membership_status: "invited",
        invited_at: now,
        attributed_programme_code: String(body.programme_code || installer.attributed_programme_code || "").trim().toLowerCase(),
      });
      return Response.json({ success: true, profile: updated });
    }

    if (action !== "activate") {
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    }

    // Activate without duplicating welcome bonus if already available/issued/redeemed.
    const welcomeStatus = installer.welcome_reward_status;
    const shouldGrantWelcome = !welcomeStatus || welcomeStatus === "deferred";
    const patch: Record<string, unknown> = {
      membership_status: "active",
      activated_at: now,
      reward_account_status: "active",
      reward_account_reason: "",
      reward_account_review_by: user.email,
      reward_account_review_at: now,
      attributed_programme_code: String(body.programme_code || installer.attributed_programme_code || "").trim().toLowerCase(),
    };
    if (shouldGrantWelcome) {
      patch.welcome_reward_amount = Number(installer.welcome_reward_amount || 10);
      patch.welcome_reward_status = "available";
    }
    if (!installer.programme_terms_version && body.programme_terms_accepted !== false) {
      // Activation for pre-registered installers still requires terms on first incentive use;
      // do not invent acceptance here unless admin confirms.
    }

    const updated = await base44.asServiceRole.entities.Installer.update(installer.id, patch);

    if (body.send_notification === true && installer.notify_programme_availability !== false) {
      try {
        const wholesaler = installer.nominated_wholesaler || installer.preferred_wholesaler_manual || "your preferred wholesaler";
        const branch = installer.nominated_branch || installer.preferred_branch_manual || "your area";
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: installer.user_email,
          from_name: "FastAmps Connect",
          subject: "FastAmps Connect is now available in your area!",
          body: [
            `Hi ${String(installer.full_name || "").split(" ")[0] || "there"},`,
            "",
            "Good news! FastAmps Connect is now available through a participating electrical wholesaler in your area.",
            "",
            `Participating branch: ${wholesaler} – ${branch}`,
            "",
            "You can now activate your account and start earning rewards for eligible FastAmps charger installations.",
            "",
            "Open FastAmps Connect: https://connect.fastamps.com/login",
            "",
            "FastAmps Connect",
          ].join("\n"),
        });
        await base44.asServiceRole.entities.Installer.update(installer.id, {
          availability_notified_at: now,
        });
      } catch (emailError) {
        console.error("availability notification failed", emailError);
      }
    }

    return Response.json({
      success: true,
      profile: updated,
      welcome_bonus_granted: shouldGrantWelcome,
    });
  } catch (error) {
    console.error("activate-installer-membership failed", error);
    return Response.json({ error: error?.message || "Membership update failed." }, { status: 500 });
  }
});
