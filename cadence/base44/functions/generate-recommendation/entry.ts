/**
 * generate-recommendation
 * Scores intake + generates channel draft via InvokeLLM.
 * Same workflow as the previous client-side engine — logic moved server-side.
 *
 * KEEP SCORING IN SYNC with src/lib/decisionEngine.js
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";


const DECISION_TYPES = new Set([
  "decide",
  "escalate",
  "unblock",
  "align",
  "brainstorm",
  "inform",
  "update",
]);

const URGENCY = new Set(["critical", "high", "medium", "low", "none"]);
const COMPLEXITY = new Set(["highly_complex", "complex", "moderate", "simple"]);
const STAKEHOLDER = new Set(["1-2", "3-5", "6-10", "10+"]);
const RISK = new Set(["high", "medium", "low"]);
const IMPACT = new Set(["high", "medium", "low"]);

function normaliseDecisionTypes(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(String).filter((t) => DECISION_TYPES.has(t));
}

function calculateFactors(input) {
  let meetingScore = 0;
  let emailScore = 0;
  let asyncScore = 0;

  if (input.is_recurring) meetingScore += 15;

  if (input.urgency === "critical") meetingScore += 30;
  else if (input.urgency === "high") meetingScore += 20;
  else if (input.urgency === "medium") emailScore += 15;
  else if (input.urgency === "low") asyncScore += 15;
  else if (input.urgency === "none") asyncScore += 25;

  if (input.complexity === "highly_complex") meetingScore += 25;
  else if (input.complexity === "complex") meetingScore += 15;
  else if (input.complexity === "moderate") emailScore += 10;
  else asyncScore += 15;

  for (const type of normaliseDecisionTypes(input.decision_type)) {
    if (["decide", "escalate", "unblock"].includes(type)) meetingScore += 20;
    else if (["align", "brainstorm"].includes(type)) meetingScore += 15;
    else if (type === "inform") emailScore += 20;
    else if (type === "update") asyncScore += 20;
  }

  if (input.stakeholder_count === "10+") meetingScore += 10;
  else if (input.stakeholder_count === "6-10") meetingScore += 5;
  else if (input.stakeholder_count === "3-5") meetingScore += 10;
  else emailScore += 15;

  if (input.emotional_risk === "high") meetingScore += 25;
  else if (input.emotional_risk === "medium") meetingScore += 15;
  else if (input.emotional_risk === "low") emailScore += 10;

  if (input.change_impact === "high") meetingScore += 20;
  else if (input.change_impact === "medium") meetingScore += 10;
  else emailScore += 10;

  if (input.cross_team_dependencies) meetingScore += 15;

  return { meetingScore, emailScore, asyncScore };
}

function calculateConfidence(meetingScore, emailScore, asyncScore, winner) {
  const sorted = [meetingScore, emailScore, asyncScore].sort((a, b) => b - a);
  const gap = sorted[0] - sorted[1];
  if (gap > 30) return 95;
  if (gap > 20) return 85;
  if (gap > 10) return 75;
  if (gap > 5) return 65;
  return 55;
}

function getProjectCadence(projectLength) {
  return (
    {
      "1-3_months":
        "Weekly standup (15 min) + Bi-weekly planning (45 min) + Kick-off & Retrospective",
      "3-6_months":
        "Weekly standup (15 min) + Weekly planning (30 min) + Monthly review (60 min) + Kick-off & Retrospective",
      "6-12_months":
        "Daily standup (15 min) + Weekly planning (45 min) + Bi-weekly stakeholder sync (30 min) + Monthly retrospective (60 min) + Kick-off & Final review",
      "12+_months":
        "Daily standup (15 min) + Weekly planning (45 min) + Bi-weekly stakeholder sync (30 min) + Monthly retrospective (60 min) + Quarterly review (90 min) + Kick-off & Final review",
    }[projectLength] || "Weekly meetings with regular check-ins"
  );
}

function generateMetadata(recommendation, input) {
  const metadata = {};
  if (recommendation !== "meeting") return metadata;

  if (input.complexity === "highly_complex") metadata.meeting_length = "60-90 minutes";
  else if (input.complexity === "complex") metadata.meeting_length = "45-60 minutes";
  else if (input.complexity === "moderate") metadata.meeting_length = "30-45 minutes";
  else metadata.meeting_length = "15-30 minutes";

  if (input.is_recurring) {
    if (input.recurring_type === "project" && input.project_length) {
      metadata.meeting_cadence = getProjectCadence(input.project_length);
    } else if (input.recurring_type === "team") {
      metadata.meeting_cadence = "Weekly team sync (30-45 min)";
    } else if (input.recurring_type === "company") {
      metadata.meeting_cadence = "Monthly all-hands (45-60 min)";
    } else {
      metadata.meeting_cadence = "Recurring (weekly or bi-weekly)";
    }
  } else {
    metadata.meeting_cadence = "One-time meeting";
  }

  metadata.participants =
    input.stakeholder_count === "10+"
      ? "Consider breaking into smaller working sessions"
      : "Include decision-makers and key contributors only";

  return metadata;
}

function getBestPractices(input) {
  if (!input.is_recurring || !input.recurring_type) return "";
  if (input.recurring_type === "company") {
    return `BEST PRACTICES FOR ENGAGING COMPANY MEETINGS:

  1. INTERACTIVE ELEMENTS
  - Live polls and Q&A sessions
  - Small group breakouts for discussion
  - Recognition and celebrations (wins, milestones)
  - Employee spotlights or demos

  2. CONTENT VARIETY
  - Mix of business updates, culture moments, and learning
  - Guest speakers or cross-functional presentations
  - Visual storytelling (videos, infographics)
  - Keep presentations under 5 minutes each

  3. ENGAGEMENT TACTICS
  - Send agenda 48 hours in advance
  - Start with a compelling hook or surprising stat
  - Use chat for real-time reactions and questions
  - End with clear next steps and action items

  4. LOGISTICS
  - Consistent time and day (e.g., First Friday 10am)
  - Record for those who can't attend live
  - Limit to 45-60 minutes maximum
  - Create psychological safety for questions

  5. FOLLOW-UP
  - Send summary highlights within 24 hours
  - Share recording and resources
  - Solicit feedback on what's working
  - Rotate facilitators to keep it fresh`;
  }
  if (input.recurring_type === "team") {
    return `BEST PRACTICES FOR EFFECTIVE TEAM MEETINGS:

  1. Clear purpose and outcomes for each meeting
  2. Rotate facilitator to build ownership
  3. Start with wins and blockers
  4. Time-box each topic strictly
  5. End with action items and owners
  6. Cancel if no critical topics (respect everyone's time)`;
  }
  if (input.recurring_type === "project") {
    return `BEST PRACTICES FOR PROJECT MEETINGS:

  1. KICK-OFF MEETING: Align on goals, roles, success metrics
  2. STANDUPS: Keep to 15 min, focus on blockers
  3. PLANNING: Review priorities, assign work, estimate effort
  4. REVIEWS: Demo progress, gather feedback, adjust course
  5. RETROSPECTIVES: What worked, what didn't, action items for improvement
  6. Always maintain visible project board/tracker`;
  }
  return "";
}

function applyDecisionRules(scores, input) {
  const { meetingScore, emailScore, asyncScore } = scores;
  const winner = Math.max(meetingScore, emailScore, asyncScore);
  let recommendation;
  const rationale = [];

  if (meetingScore === winner) {
    recommendation = "meeting";
    if (input.urgency === "critical" || input.urgency === "high") {
      rationale.push("High urgency requires real-time discussion");
    }
    if (input.complexity === "highly_complex" || input.complexity === "complex") {
      rationale.push("Complex topics benefit from interactive dialogue");
    }
    if (input.emotional_risk === "high") {
      rationale.push("Sensitive content needs nuanced, face-to-face communication");
    }
    if (
      normaliseDecisionTypes(input.decision_type).some((t) =>
        ["decide", "escalate", "unblock"].includes(t)
      )
    ) {
      rationale.push("Critical decisions are best made synchronously");
    }
    if (input.cross_team_dependencies) {
      rationale.push("Cross-functional alignment requires collaborative discussion");
    }
  } else if (emailScore === winner) {
    recommendation = "email";
    if (input.urgency === "low" || input.urgency === "medium") {
      rationale.push("Timeline allows for thoughtful written response");
    }
    if (normaliseDecisionTypes(input.decision_type).includes("inform")) {
      rationale.push("Information sharing is efficient via email");
    }
    if (input.stakeholder_count === "1-2") {
      rationale.push("Small group makes email effective");
    }
    if (input.complexity === "simple") {
      rationale.push("Straightforward topic doesn't require meeting time");
    }
  } else {
    recommendation = "async_message";
    rationale.push("Quick update best delivered asynchronously");
    if (normaliseDecisionTypes(input.decision_type).includes("update")) {
      rationale.push("Status updates don't require synchronous time");
    }
    if (input.urgency === "low") {
      rationale.push("Low urgency supports async communication");
    }
  }

  return {
    recommendation,
    confidence: calculateConfidence(meetingScore, emailScore, asyncScore, winner),
    rationale: `${rationale.join(". ")}.`,
    metadata: generateMetadata(recommendation, input),
    best_practices: getBestPractices(input),
    scores: { meetingScore, emailScore, asyncScore },
  };
}

function estimateTimeSavedMinutes(recommendation, input) {
  let minutes = 0;
  if (recommendation === "async_message") minutes += 25;
  else if (recommendation === "email") minutes += 20;
  else if (recommendation === "meeting") {
    if (input.stakeholder_count === "1-2" || input.stakeholder_count === "3-5") minutes += 10;
  }
  if ((input.urgency === "low" || input.urgency === "none") && recommendation !== "meeting") {
    minutes += 5;
  }
  if (input.complexity === "simple" && recommendation !== "meeting") minutes += 5;
  return Math.max(minutes, 0);
}

function analyze(input) {
  return applyDecisionRules(calculateFactors(input), input);
}

/** Soft-sanitize free text before it is embedded in LLM prompts. */
function sanitizePromptText(value, { max = 500 } = {}) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validateIntake(body) {
  const errors = [];
  const title = sanitizePromptText(body?.title, { max: 200 });
  const purpose = sanitizePromptText(body?.purpose, { max: 1000 });
  if (!title) errors.push("title is required");
  if (!purpose) errors.push("purpose is required");

  const urgency = String(body?.urgency || "medium");
  const complexity = String(body?.complexity || "moderate");
  const stakeholder_count = String(body?.stakeholder_count || "3-5");
  const emotional_risk = String(body?.emotional_risk || "low");
  const change_impact = String(body?.change_impact || "low");
  const communication_style = sanitizePromptText(body?.communication_style || "detailed", {
    max: 40,
  });

  if (!URGENCY.has(urgency)) errors.push("invalid urgency");
  if (!COMPLEXITY.has(complexity)) errors.push("invalid complexity");
  if (!STAKEHOLDER.has(stakeholder_count)) errors.push("invalid stakeholder_count");
  if (!RISK.has(emotional_risk)) errors.push("invalid emotional_risk");
  if (!IMPACT.has(change_impact)) errors.push("invalid change_impact");

  const decision_type = normaliseDecisionTypes(body?.decision_type);
  if (!decision_type.length) errors.push("decision_type is required");

  return {
    errors,
    input: {
      title,
      purpose,
      urgency,
      complexity,
      decision_type,
      stakeholder_count,
      stakeholder_groups: sanitizePromptText(body?.stakeholder_groups, { max: 300 }),
      emotional_risk,
      change_impact,
      cross_team_dependencies: Boolean(body?.cross_team_dependencies),
      time_sensitivity: sanitizePromptText(body?.time_sensitivity, { max: 120 }),
      communication_style,
      additional_context: sanitizePromptText(body?.additional_context, { max: 1000 }),
      is_recurring: Boolean(body?.is_recurring),
      recurring_type: sanitizePromptText(body?.recurring_type, { max: 40 }),
      project_length: sanitizePromptText(body?.project_length, { max: 40 }),
    },
  };
}



function buildMeetingPrompt(input, metadata) {
  const decisionType = Array.isArray(input.decision_type) ? input.decision_type.join(", ") : input.decision_type;
  return `Create a clean, structured, professional meeting agenda for a leader.

Context:
Title: ${input.title}
Purpose: ${input.purpose}
Duration: ${metadata.meeting_length || "30-45 minutes"}
Participants: ${input.stakeholder_groups || "Key stakeholders"}
Decision Type: ${decisionType}
Complexity: ${input.complexity}

Format the agenda with clear sections using sentence case:

Meeting title
${input.title}

Purpose
One clear sentence stating what this meeting will accomplish.

Desired outcomes
2-4 specific, measurable results we need from this meeting (not actions, but outcomes).

Participants
List key participants and their roles in this discussion.

Agenda (time-blocked)
Break the ${metadata.meeting_length || "30-45 minutes"} into logical time blocks with clear topics.
Use bullet points for sub-items within each time block.

Pre-work and materials
What participants should review or prepare before the meeting.

CRITICAL FORMATTING RULES:
- Use plain text only - NO asterisks, NO markdown symbols, NO special characters for formatting
- Use sentence case for all headings (e.g., "Purpose" not "PURPOSE")
- Use simple bullets with dashes (-) or numbers (1, 2, 3)
- Use double line breaks between sections for visual breathing room
- Keep paragraphs short and scannable
- Make it polished, action-oriented, and leadership-ready`;
}

function buildEmailPrompt(input) {
  return `Draft a professional, action-oriented email for a leader.

Context:
Topic: ${input.title}
Purpose: ${input.purpose}
Urgency: ${input.urgency}
Timeline: ${input.time_sensitivity || "At your earliest convenience"}
Communication Style: ${input.communication_style}

Format with sentence case and clear structure:

Subject: [Clear, action-oriented subject line]

Hi [Team/Name],

[One sentence framing the issue and why it matters]

[2-3 short sentences providing essential context - what led to this, what's at stake]

[Clear statement of what decision or action is needed]

Next steps:
- [Specific action item with owner]
- [Timeline or deadline]
- [How to respond or escalate]

[Professional, warm closing that reinforces the ask]

Best,
[Your name]

FORMATTING RULES:
- Use sentence case for "Subject:" and "Next steps:" headers
- Keep paragraphs short (2-3 sentences max)
- Use simple dashes (-) for bullet points
- Add spacing between sections
- Make it concise, clear, respectful of time
- Match the ${input.communication_style} style with appropriate warmth and directness`;
}

function buildAsyncPrompt(input) {
  return `Draft a concise, friendly Slack/Teams message for a leader.

Context:
Topic: ${input.title}
Purpose: ${input.purpose}
Urgency: ${input.urgency}
Communication Style: ${input.communication_style}

Format with modern, async-friendly structure:

[One clear sentence setting context]

Key points:
- [Key point 1]
- [Key point 2]
- [Key point 3 if needed]

Next step:
[One clear action or ask]

Timeline: [When this needs action]

FORMATTING RULES:
- Keep under 150 words
- Use sentence case for "Key points:" and "Next step:" and "Timeline:" headers
- Use simple dashes (-) or bullet points
- Use a friendly but professional tone—modern workplace communication
- Include relevant emoji if appropriate (e.g., for timeline or action items)
- Make it scannable and low-friction`;
}

function llmText(result) {
  if (typeof result === "string") return result;
  return result?.response ?? result?.answer ?? String(result ?? "");
}


export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Please sign in to get a recommendation." }, { status: 401 });
    }

    const body = await req.json();
    const { errors, input } = validateIntake(body);
    if (errors.length) {
      return Response.json({ error: errors.join("; ") }, { status: 400 });
    }

    const scored = analyze(input);
    const drafts: Record<string, string> = {};

    if (scored.recommendation === "meeting") {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildMeetingPrompt(input, scored.metadata),
        model: "gpt_5_mini",
      });
      drafts.generated_agenda = llmText(result);
    } else if (scored.recommendation === "email") {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildEmailPrompt(input),
        model: "gpt_5_mini",
      });
      drafts.generated_email = llmText(result);
    } else {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildAsyncPrompt(input),
        model: "gpt_5_mini",
      });
      drafts.generated_message = llmText(result);
    }

    const decision = {
      ...input,
      recommendation: scored.recommendation,
      confidence_score: scored.confidence,
      rationale: scored.rationale,
      meeting_length: scored.metadata.meeting_length || "",
      meeting_cadence: scored.metadata.meeting_cadence || "",
      participants: scored.metadata.participants || "",
      best_practices: scored.best_practices || "",
      time_saved_minutes: estimateTimeSavedMinutes(scored.recommendation, input),
      ...drafts,
      status: "draft",
    };

    return Response.json({ decision });
  } catch (error) {
    console.error("generate-recommendation failed", error);
    return Response.json(
      { error: error?.message || "Failed to generate recommendation" },
      { status: 500 },
    );
  }
}
