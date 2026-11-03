import { createClientFromRequest } from "npm:@base44/sdk";

/**
 * Installer accepts an open opportunity via a concurrency-safe claim on status.
 */
export default async function (req) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const db = createClientFromRequest(req);
  try {
    const user = await db.auth.me();
    if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });

    const body = await req.json();
    const opportunityId = String(body.opportunity_id || "").trim();
    if (!opportunityId) return Response.json({ error: "opportunity_id is required." }, { status: 400 });

    const installer = (await db.asServiceRole.entities.Installer.filter({ user_email: user.email }))[0];
    if (!installer) return Response.json({ error: "Installer profile not found." }, { status: 404 });

    const result = await db.asServiceRole.entities.Opportunity.updateMany(
      { id: opportunityId, status: "open" },
      { $set: { status: "accepted", accepted_by: installer.mobile } },
    );
    if (Number(result?.updated) !== 1) {
      return Response.json({ error: "This opportunity is no longer available." }, { status: 409 });
    }

    const opportunity = await db.asServiceRole.entities.Opportunity.get(opportunityId);
    return Response.json({ success: true, opportunity });
  } catch (error) {
    console.error("accept-opportunity failed", error);
    return Response.json({ error: error?.message || "Could not accept opportunity." }, { status: 500 });
  }
}
