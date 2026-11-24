import { createClientFromRequest } from "npm:@base44/sdk";

const ALLOWED_STATUS = new Set(["draft", "active", "paused", "closed"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    // Public invitation lookup — no admin role required.
    if (action === "public_invite") {
      const code = String(body.programme_code || "").trim().toLowerCase();
      if (!code) return Response.json({ error: "programme_code is required." }, { status: 400 });
      const matches = await base44.asServiceRole.entities.IncentiveProgramme.filter({ programme_code: code });
      const programme = matches[0];
      if (!programme || programme.invitation_enabled === false) {
        return Response.json({
          found: false,
          active: false,
          message: "This invitation is not currently available. You can still pre-register your interest in FastAmps Connect.",
        });
      }
      const active = programme.status === "active";
      return Response.json({
        found: true,
        active,
        programme_code: programme.programme_code,
        name: programme.name,
        wholesaler_name: programme.wholesaler_name,
        branch_name: programme.branch_name,
        status: programme.status,
        message: active
          ? `Join the FastAmps Connect programme at ${programme.wholesaler_name}, ${programme.branch_name}.`
          : `The ${programme.wholesaler_name} ${programme.branch_name} programme is not active yet. Pre-register and we will notify you when it opens.`,
      });
    }

    const user = await base44.auth.me();
    if (!user?.email || user.role !== "admin") {
      return Response.json({ error: "Administrator access required." }, { status: 403 });
    }

    if (action === "list" || action === "get") {
      const code = String(body.programme_code || "").trim().toLowerCase();
      if (code) {
        const matches = await base44.asServiceRole.entities.IncentiveProgramme.filter({ programme_code: code });
        return Response.json({ programme: matches[0] || null });
      }
      const programmes = await base44.asServiceRole.entities.IncentiveProgramme.list("-created_date", 100);
      return Response.json({ programmes });
    }

    if (action === "ensure_links_beta") {
      const code = "links-electrical-shrewsbury";
      const existing = await base44.asServiceRole.entities.IncentiveProgramme.filter({ programme_code: code });
      if (existing.length) {
        return Response.json({ programme: existing[0], created: false });
      }
      const programme = await base44.asServiceRole.entities.IncentiveProgramme.create({
        name: "FastAmps Connect – Links Electrical Beta",
        programme_code: code,
        wholesaler_name: "Links Electrical",
        branch_name: "Shrewsbury",
        country: "United Kingdom",
        currency: "GBP",
        programme_type: "controlled_commercial_beta",
        status: "draft",
        claim_verification: "manual_admin_approval",
        payout_mode: "held_pending_authorisation",
        expected_charger_allocation: 200,
        invitation_enabled: true,
        notes: "Draft/inactive until Edd authorises genuine charger codes and JP explicitly activates the programme. Do not auto-activate.",
        last_status_changed_by: user.email,
      });
      return Response.json({ programme, created: true });
    }

    if (action === "set_status") {
      const id = String(body.programme_id || "").trim();
      const status = String(body.status || "").trim();
      if (!id || !ALLOWED_STATUS.has(status)) {
        return Response.json({ error: "Provide programme_id and a valid status (draft|active|paused|closed)." }, { status: 400 });
      }
      if (status === "active" && body.confirm_activation !== true) {
        return Response.json({
          error: "Activation requires confirm_activation=true after genuine codes are imported and JP authorises go-live.",
        }, { status: 400 });
      }

      const current = await base44.asServiceRole.entities.IncentiveProgramme.filter({ id });
      const programme = current[0];
      if (!programme) return Response.json({ error: "Programme not found." }, { status: 404 });

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        status,
        last_status_changed_by: user.email,
      };
      if (status === "active") patch.activated_at = now;
      if (status === "paused") patch.paused_at = now;
      if (status === "closed") patch.closed_at = now;
      if (typeof body.invitation_enabled === "boolean") patch.invitation_enabled = body.invitation_enabled;

      const updated = await base44.asServiceRole.entities.IncentiveProgramme.update(programme.id, patch);
      return Response.json({ programme: updated });
    }

    if (action === "demand_summary") {
      const installers = await base44.asServiceRole.entities.Installer.list("-created_date", 5000);
      const summary = new Map<string, any>();
      for (const installer of installers) {
        if (installer.excluded_from_reporting || installer.is_demo) continue;
        const wholesaler = String(installer.nominated_wholesaler || installer.preferred_wholesaler_manual || "Unknown").trim();
        const branch = String(installer.nominated_branch || installer.preferred_branch_manual || "Unknown").trim();
        const key = `${wholesaler}||${branch}`.toLowerCase();
        if (!summary.has(key)) {
          summary.set(key, {
            wholesaler_name: wholesaler,
            branch_name: branch,
            town: installer.town_city || "",
            postcode: installer.postcode || "",
            interested: 0,
            active: 0,
            invited: 0,
            suspended: 0,
          });
        }
        const row = summary.get(key);
        const status = installer.membership_status || "active";
        if (status === "pre_registered") row.interested += 1;
        else if (status === "invited") row.invited += 1;
        else if (status === "suspended") row.suspended += 1;
        else row.active += 1;
      }
      return Response.json({ branches: [...summary.values()].sort((a, b) => (b.interested + b.active) - (a.interested + a.active)) });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("manage-incentive-programme failed", error);
    return Response.json({ error: error?.message || "Programme management failed." }, { status: 500 });
  }
});
