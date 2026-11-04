import { createClientFromRequest } from "npm:@base44/sdk";

const MILESTONE = 5;
const PAGE_SIZE = 500;

async function listFiltered(entity: any, query: Record<string, unknown>) {
  const rows: any[] = [];
  let offset = 0;
  for (let page = 0; page < 100; page += 1) {
    const batch = await entity.filter(query, "-created_date", PAGE_SIZE, offset);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
  throw new Error("The referral history is too large to display. Please contact FastAmps support.");
}

function displayName(value: unknown) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Referred installer";
  if (parts.length === 1) return parts[0].slice(0, 40);
  return `${parts[0].slice(0, 40)} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Sign in to see your referral progress." }, { status: 401 });
    }

    // Never accept a referrer ID, email or code from the caller. Resolve the
    // owner from their authenticated Base44 session alone.
    const profiles = await base44.asServiceRole.entities.Installer.filter({ user_email: user.email });
    const owner = profiles[0];
    if (!owner || owner.excluded_from_reporting) {
      return Response.json({ error: "An active installer profile is required." }, { status: 404 });
    }

    const matchingById = await listFiltered(base44.asServiceRole.entities.Installer, {
      referred_by_installer_id: owner.id,
    });

    // Older registrations may have a matching registration code but no linked
    // referrer ID. Include those only when no conflicting referrer ID exists.
    const matchingByCode = owner.referral_code
      ? await listFiltered(base44.asServiceRole.entities.Installer, { referred_by_code: owner.referral_code })
      : [];

    const referred = [...new Map([...matchingById, ...matchingByCode]
      .filter((candidate) =>
        candidate.id !== owner.id
        && !candidate.excluded_from_reporting
        && String(candidate.user_email || "").toLowerCase() !== String(owner.user_email || "").toLowerCase()
        && (candidate.referred_by_installer_id === owner.id
          || (!candidate.referred_by_installer_id && candidate.referred_by_code === owner.referral_code)))
      .map((candidate) => [candidate.id, candidate])).values()]
      .sort((a, b) => String(b.referred_at || b.created_date || "").localeCompare(String(a.referred_at || a.created_date || "")));

    const entries = await Promise.all(referred.map(async (candidate) => {
      // Count unique FastAmps-approved charger serial numbers, not scan counts,
      // pending claims, or the unverified "installs" profile counter.
      const claims = await listFiltered(base44.asServiceRole.entities.InstallClaim, {
        installer_email: candidate.user_email,
      });
      const approvedSerials = new Set();
      const pendingSerials = new Set();
      for (const claim of claims) {
        if (claim.excluded_from_reporting || claim.is_demo) continue;
        const serial = String(claim.serial_number || "").trim().toUpperCase();
        if (!serial) continue;
        if (claim.status === "approved" && !["held", "rejected"].includes(claim.reward_status) &&
          claim.serial_photo_url && claim.install_photo_url) approvedSerials.add(serial);
        else if (["submitted", "needs_information"].includes(claim.status)) pendingSerials.add(serial);
      }
      const approved = approvedSerials.size;
      const pending = [...pendingSerials].filter((serial) => !approvedSerials.has(serial)).length;
      const credited = candidate.referral_qualified === true;
      const status = candidate.referral_review_status === "rejected" ? "rejected"
        : candidate.referral_review_status === "held" || ["held", "blocked"].includes(owner.reward_account_status) ? "held"
        : credited ? "reward_earned" : approved >= MILESTONE ? "awaiting_reward_confirmation"
        : approved > 0 ? "in_progress" : "registered";
      return {
        referral_id: candidate.id,
        display_name: displayName(candidate.full_name),
        joined_at: candidate.referred_at || candidate.created_date || null,
        approved_installs: approved,
        pending_review: pending,
        milestone: MILESTONE,
        installs_remaining: Math.max(MILESTONE - approved, 0),
        reward_value: 20,
        reward_status: status,
        reward_awarded_at: credited ? candidate.referral_qualified_at || null : null,
      };
    }));

    return Response.json({
      success: true,
      referral_code: owner.referral_code || "",
      milestone: MILESTONE,
      reward_value: 20,
      registered_count: entries.length,
      qualified_count: entries.filter((item) => item.reward_status === "reward_earned").length,
      awaiting_confirmation_count: entries.filter((item) => item.reward_status === "awaiting_reward_confirmation").length,
      referrals: entries,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("get-referral-progress failed", error);
    return Response.json({ error: "Could not load referral progress. Please try again." }, { status: 500 });
  }
});
