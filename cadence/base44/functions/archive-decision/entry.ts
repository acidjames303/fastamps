/**
 * archive-decision
 * Archives a decision only if the signed-in user owns it.
 * Same UX as History "archive" — ownership enforced here.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";

export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Please sign in to archive a decision." }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body?.id || "").trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.CommunicationDecision.get(id);
    if (!existing) {
      return Response.json({ error: "Decision not found" }, { status: 404 });
    }
    if (existing.owner_email !== user.email && user.role !== "admin") {
      return Response.json({ error: "Not allowed to archive this decision" }, { status: 403 });
    }

    const updated = await base44.asServiceRole.entities.CommunicationDecision.update(id, {
      status: "archived",
    });
    return Response.json({ decision: updated });
  } catch (error) {
    console.error("archive-decision failed", error);
    return Response.json(
      { error: error?.message || "Failed to archive decision" },
      { status: 500 },
    );
  }
}
