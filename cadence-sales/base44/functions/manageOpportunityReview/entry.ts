import { resolveTenant } from '../../shared/tenantAuth.ts';
import { canSubmitForReview, getQualificationState } from '../../shared/qualificationRules.ts';

const VALID_ACTIONS = ['submit', 'approve', 'request_changes', 'reject', 'return_to_qualifying'];

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { opportunity_id, action, notes, client_visible_summary } = body;

    if (!opportunity_id || !action) {
      return Response.json({ error: 'opportunity_id and action are required' }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const opp = await base44.entities.Opportunity.get(opportunity_id);
    if (!opp || opp.organisation_id !== org.id) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now };
    let auditAction = '';
    let auditPrev = opp.manager_review_status;

    if (action === 'submit') {
      // Caller submitting for manager review — must be qualified
      if (!canSubmitForReview(opp)) {
        const state = getQualificationState(opp);
        return Response.json({
          error: `Opportunity must be qualified before submitting for review (currently: ${state}).`,
          qualification_state: state,
        }, { status: 400 });
      }
      updates.manager_review_status = 'awaiting_review';
      updates.handoff_status = 'awaiting_review';
      updates.stage = 'qualified';
      auditAction = 'opportunity_submitted_for_review';
    }
    else if (action === 'approve') {
      // Manager approving for handoff — must be manager/admin
      if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
        return Response.json({ error: 'Only managers can approve opportunities for handoff.' }, { status: 403 });
      }
      updates.manager_review_status = 'approved';
      updates.handoff_status = 'approved';
      updates.manager_reviewed_by = user.id;
      updates.manager_reviewed_at = now;
      updates.manager_review_notes = notes || '';
      updates.stage = 'handoff_ready';
      if (client_visible_summary) updates.ai_summary = client_visible_summary;
      auditAction = 'opportunity_review_approved';
    }
    else if (action === 'request_changes') {
      if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
        return Response.json({ error: 'Only managers can request changes.' }, { status: 403 });
      }
      updates.manager_review_status = 'changes_requested';
      updates.handoff_status = 'changes_requested';
      updates.manager_reviewed_by = user.id;
      updates.manager_reviewed_at = now;
      updates.manager_review_notes = notes || '';
      auditAction = 'opportunity_review_changes_requested';
    }
    else if (action === 'reject') {
      if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
        return Response.json({ error: 'Only managers can reject opportunities.' }, { status: 403 });
      }
      updates.manager_review_status = 'rejected';
      updates.qualification_status = 'disqualified';
      updates.manager_reviewed_by = user.id;
      updates.manager_reviewed_at = now;
      updates.manager_review_notes = notes || '';
      auditAction = 'opportunity_review_rejected';
    }
    else if (action === 'return_to_qualifying') {
      if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
        return Response.json({ error: 'Only managers can return opportunities to qualifying.' }, { status: 403 });
      }
      updates.manager_review_status = 'not_submitted';
      updates.handoff_status = 'not_ready';
      updates.qualification_status = 'qualifying';
      updates.stage = 'qualifying';
      updates.manager_reviewed_by = user.id;
      updates.manager_reviewed_at = now;
      updates.manager_review_notes = notes || '';
      auditAction = 'opportunity_review_changes_requested';
    }

    const updated = await base44.entities.Opportunity.update(opportunity_id, updates);

    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: org.id,
      actor_user_id: user.id,
      action: auditAction,
      entity_type: 'Opportunity',
      entity_id: opportunity_id,
      previous_value: auditPrev,
      new_value: updates.manager_review_status || action,
      timestamp: now,
    });

    return Response.json({ opportunity: updated });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}