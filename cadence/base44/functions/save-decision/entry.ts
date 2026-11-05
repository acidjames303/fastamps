/**
 * save-decision
 * Persists a CommunicationDecision owned by the signed-in user.
 * Same UX: "Save to History" after a recommendation — ownership enforced here.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";

const RECOMMENDATIONS = new Set(["meeting", "email", "async_message"]);

function clean(value: unknown, max = 5000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim()
    .slice(0, max);
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Please sign in to save a decision." }, { status: 401 });
    }

    const body = await req.json();
    const title = clean(body?.title, 200);
    const purpose = clean(body?.purpose, 1000);
    const recommendation = String(body?.recommendation || "");
    if (!title || !purpose) {
      return Response.json({ error: "title and purpose are required" }, { status: 400 });
    }
    if (!RECOMMENDATIONS.has(recommendation)) {
      return Response.json({ error: "invalid recommendation" }, { status: 400 });
    }

    const record = {
      owner_email: user.email,
      title,
      purpose,
      urgency: clean(body?.urgency, 40),
      complexity: clean(body?.complexity, 40),
      decision_type: Array.isArray(body?.decision_type)
        ? body.decision_type.map((t: unknown) => clean(t, 40)).filter(Boolean)
        : [],
      stakeholder_count: clean(body?.stakeholder_count, 40),
      stakeholder_groups: clean(body?.stakeholder_groups, 300),
      emotional_risk: clean(body?.emotional_risk, 40),
      change_impact: clean(body?.change_impact, 40),
      cross_team_dependencies: Boolean(body?.cross_team_dependencies),
      time_sensitivity: clean(body?.time_sensitivity, 120),
      communication_style: clean(body?.communication_style, 40),
      additional_context: clean(body?.additional_context, 1000),
      is_recurring: Boolean(body?.is_recurring),
      recurring_type: clean(body?.recurring_type, 40),
      project_length: clean(body?.project_length, 40),
      recommendation,
      confidence_score: Number(body?.confidence_score) || 0,
      rationale: clean(body?.rationale, 2000),
      meeting_length: clean(body?.meeting_length, 80),
      meeting_cadence: clean(body?.meeting_cadence, 300),
      participants: clean(body?.participants, 300),
      best_practices: clean(body?.best_practices, 5000),
      time_saved_minutes: Math.max(0, Number(body?.time_saved_minutes) || 0),
      generated_agenda: clean(body?.generated_agenda, 8000),
      generated_email: clean(body?.generated_email, 8000),
      generated_message: clean(body?.generated_message, 4000),
      status: "draft",
    };

    // Service role create so owner_email cannot be spoofed by a client entity.create call.
    const created = await base44.asServiceRole.entities.CommunicationDecision.create(record);
    return Response.json({ decision: created });
  } catch (error) {
    console.error("save-decision failed", error);
    return Response.json(
      { error: error?.message || "Failed to save decision" },
      { status: 500 },
    );
  }
}
