import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';

// Controlled product feedback management — platform owner only.
// Customer users can create feedback (via submitFeedback) but cannot change
// product status, priority, decision, or mark delivered.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const { action, feedback_id, status, product_decision, decision_reason, priority_score, linked_release_id, duplicate_of_id, reviewed_notes } = body;

    if (!action) {
      return Response.json({ error: 'action is required.' }, { status: 400 });
    }

    if (action === 'list') {
      // List all feedback across all orgs for platform review.
      const feedback = await base44.asServiceRole.entities.ProductFeedback.list('-created_at', 200);
      return Response.json({ feedback });
    }

    if (!feedback_id) {
      return Response.json({ error: 'feedback_id is required.' }, { status: 400 });
    }

    const items = await base44.asServiceRole.entities.ProductFeedback.filter({ id: feedback_id });
    const item = items && items[0];
    if (!item) {
      return Response.json({ error: 'Feedback not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now, reviewed_at: now, reviewed_by_user_id: user.id };

    if (action === 'review') {
      if (status) updates.status = status;
      if (product_decision) updates.product_decision = product_decision;
      if (decision_reason !== undefined) updates.decision_reason = decision_reason;
      if (priority_score !== undefined) updates.priority_score = priority_score;
      if (linked_release_id !== undefined) updates.linked_release_id = linked_release_id;
    } else if (action === 'group_duplicate') {
      if (!duplicate_of_id) {
        return Response.json({ error: 'duplicate_of_id is required.' }, { status: 400 });
      }
      updates.product_decision = 'duplicate';
      updates.decision_reason = 'Duplicate of ' + duplicate_of_id;
      updates.linked_support_request_id = duplicate_of_id;
    } else if (action === 'link_release') {
      if (!linked_release_id) {
        return Response.json({ error: 'linked_release_id is required.' }, { status: 400 });
      }
      updates.linked_release_id = linked_release_id;
      updates.status = 'delivered';
      updates.product_decision = 'delivered';
    } else {
      return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }

    await base44.asServiceRole.entities.ProductFeedback.update(feedback_id, updates);
    return Response.json({ ok: true, action });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}