/**
 * list-decisions
 * Returns the signed-in user's CommunicationDecision rows only.
 * Replaces client-side entity.list("-created_date", 200) with owner scoping.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";

export default async function (req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Please sign in to view history." }, { status: 401 });
    }

    let includeArchived = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        includeArchived = Boolean(body?.include_archived);
      } catch {
        includeArchived = false;
      }
    }

    const rows = await base44.asServiceRole.entities.CommunicationDecision.filter(
      { owner_email: user.email },
      "-created_date",
      200,
    );

    const decisions = (rows || []).filter((row: { status?: string }) =>
      includeArchived ? true : row.status !== "archived",
    );

    return Response.json({ decisions });
  } catch (error) {
    console.error("list-decisions failed", error);
    return Response.json(
      { error: error?.message || "Failed to list decisions" },
      { status: 500 },
    );
  }
}
