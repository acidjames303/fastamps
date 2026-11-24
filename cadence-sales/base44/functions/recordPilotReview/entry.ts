import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';

// Platform-owner weekly pilot review.
// Records review metadata on the pilot and creates PilotAction records for
// agreed actions. Does not put pilot administration into caller Today Tasks.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const { organisation_id, review_date, pilot_health, customer_feedback, usage_concerns, product_commitments, next_review_date, actions } = body;

    if (!organisation_id) {
      return Response.json({ error: 'organisation_id is required.' }, { status: 400 });
    }

    const pilots = await base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id });
    const pilot = pilots && pilots[0];
    if (!pilot) {
      return Response.json({ error: 'No pilot programme found.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update pilot with review metadata.
    await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
      pilot_health: pilot_health || pilot.pilot_health,
      renewal_likelihood: body.renewal_likelihood || pilot.renewal_likelihood,
      expansion_potential: body.expansion_potential || pilot.expansion_potential,
      updated_at: now,
    });

    // Create PilotAction records for agreed actions.
    const createdActions = [];
    if (actions && Array.isArray(actions)) {
      for (const a of actions) {
        if (!a.title) continue;
        const action = await base44.asServiceRole.entities.PilotAction.create({
          organisation_id,
          pilot_programme_id: pilot.id,
          action_type: a.action_type || 'follow_up',
          title: a.title,
          description: a.description || '',
          owner_type: a.owner_type || 'platform',
          owner_user_id: a.owner_type === 'platform' ? (a.owner_user_id || user.id) : '',
          customer_owner_name: a.customer_owner_name || '',
          status: 'open',
          priority: a.priority || 'normal',
          due_at: a.due_at || '',
          review_notes: customer_feedback || '',
          created_at: now,
          updated_at: now,
        });
        createdActions.push(action.id);
      }
    }

    // Store review metadata as a pilot action for audit trail.
    await base44.asServiceRole.entities.PilotAction.create({
      organisation_id,
      pilot_programme_id: pilot.id,
      action_type: 'follow_up',
      title: `Weekly review — ${review_date || now.split('T')[0]}`,
      description: `Health: ${pilot_health || 'n/a'}. Feedback: ${customer_feedback || 'n/a'}. Usage concerns: ${usage_concerns || 'n/a'}. Product commitments: ${product_commitments || 'n/a'}. Next review: ${next_review_date || 'n/a'}.`,
      owner_type: 'platform',
      owner_user_id: user.id,
      status: 'completed',
      priority: 'normal',
      completed_at: now,
      review_notes: customer_feedback || '',
      created_at: now,
      updated_at: now,
    }).catch(() => {});

    return Response.json({
      ok: true,
      action: 'review_recorded',
      review_date: review_date || now,
      actions_created: createdActions.length,
      next_review_date: next_review_date || '',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}