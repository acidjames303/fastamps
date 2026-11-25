import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertTaskOwned, taskIdempotencyKey, findActiveByTaskKey, isReadOnly } from '../../shared/taskLogic.ts';
import { assertCompanyOwned, assertContactOwned } from '../../shared/ownership.ts';
import {
  getOutcome, mapToLegacyOutcome, getFollowUpTaskType,
  getFollowUpSettings, nextValidCallingTime, isOpportunityQualified, isMaxAttemptsReached
} from '../../shared/outcomeRules.ts';
import { classifyCall } from '../../shared/callClassification.ts';
import { processDoNotCall } from '../../shared/doNotCall.ts';

// Authoritative call-outcome processor. Creates the CallLog, completes the
// originating task, updates contact/company status, creates follow-up tasks,
// creates/updates opportunities, and writes audit records — all server-side.
// organisation_id is never trusted from the client.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot record call outcomes.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    task_id, company_id, contact_id, campaign_id,
    outcome, notes, client_notes, internal_notes,
    info_request_topic, territory, account_manager_name, account_manager_email,
    next_action_type, next_action_at,
    qualification, conversation_type,
    started_at, ended_at, duration_seconds,
    call_provider, provider_call_id, recording_url,
  } = body || {};

  // 1. Validate outcome
  const outcomeRule = getOutcome(outcome);
  if (!outcomeRule) {
    return Response.json({ error: 'Unknown outcome: ' + outcome }, { status: 400 });
  }
  // Granular options (e.g. "Away from desk") classify as their canonical outcome.
  const primaryOutcome = (outcomeRule as Record<string, any>).primary || outcome;

  // 2. Verify referenced records belong to this org
  let task = null, company = null, contact = null;
  if (task_id) task = await assertTaskOwned(base44, org, task_id);
  if (company_id) company = await assertCompanyOwned(base44, org, company_id);
  if (contact_id) contact = await assertContactOwned(base44, org, contact_id);

  // 3. Idempotency: if task already completed, return existing result
  if (task && task.status === 'completed') {
    const existingLogs = await base44.asServiceRole.entities.CallLog.filter(
      { task_id: task.id, organisation_id: org.id }, '-created_date', 1
    ).catch(() => []);
    if (existingLogs && existingLogs[0]) {
      return Response.json({
        already_processed: true,
        call_log_id: existingLogs[0].id,
        message: 'This call outcome was already recorded.',
      });
    }
  }

  // 4. Validate follow-up date if required
  let followUpAt = next_action_at || null;
  if (outcomeRule.requires_follow_up_date && outcomeRule.requires_follow_up) {
    if (!followUpAt) {
      return Response.json({ error: 'This outcome requires a follow-up date and time.' }, { status: 400 });
    }
    const fuMs = new Date(followUpAt).getTime();
    if (isNaN(fuMs) || fuMs < Date.now()) {
      return Response.json({ error: 'Follow-up date must be a valid future date and time.' }, { status: 400 });
    }
  }

  // 5. Compute follow-up time for auto-scheduled follow-ups
  const settings = getFollowUpSettings(org);
  if (outcomeRule.requires_follow_up && !followUpAt && outcomeRule.default_follow_up_delay_minutes) {
    const fromMs = Date.now() + outcomeRule.default_follow_up_delay_minutes * 60000;
    const validMs = nextValidCallingTime(fromMs, settings);
    followUpAt = new Date(validMs).toISOString();
  }

  // 6. Determine follow-up task type
  const followUpTaskType = next_action_type || getFollowUpTaskType(outcomeRule);
  const now = new Date().toISOString();

  // 7. Detect IR recalls (same contact/company already had info requested)
  const clientFacingNotes = (client_notes || notes || '').trim();
  const internalFacingNotes = (internal_notes || '').trim();
  let isInfoRecall = false;
  if (primaryOutcome === 'connected_information_requested') {
    const priorFilter: Record<string, string> = { organisation_id: org.id, primary_outcome: 'connected_information_requested' };
    if (contact?.id) priorFilter.contact_id = contact.id;
    else if (company?.id || task?.company_id) priorFilter.company_id = company?.id || task?.company_id;
    const priorIRs = await base44.asServiceRole.entities.CallLog.filter(priorFilter, '-created_date', 5).catch(() => []);
    isInfoRecall = Array.isArray(priorIRs) && priorIRs.length > 0;
  }

  // 8. Create CallLog
  const callLogData = {
    organisation_id: org.id,
    user_id: user.id,
    created_by_user_id: user.id,
    assigned_user_id: user.id,
    contact_id: contact?.id || task?.contact_id || '',
    contact_name: contact?.full_name || '',
    company: company?.name || '',
    company_id: company?.id || task?.company_id || '',
    phone: contact?.phone || '',
    campaign_id: campaign_id || task?.target_list_id || '',
    task_id: task?.id || '',
    outcome: mapToLegacyOutcome(outcome),
    primary_outcome: primaryOutcome,
    outcome_notes: clientFacingNotes,
    notes: clientFacingNotes,
    client_notes: clientFacingNotes,
    internal_notes: internalFacingNotes,
    info_request_topic: info_request_topic || '',
    territory: territory || company?.territory || '',
    account_manager_name: account_manager_name || company?.account_manager_name || '',
    account_manager_email: account_manager_email || company?.account_manager_email || '',
    is_info_recall: isInfoRecall,
    next_action_type: outcomeRule.requires_follow_up ? followUpTaskType : '',
    next_action_at: followUpAt || '',
    qualification_status: outcomeRule.qualification_effect === 'create_opportunity'
      ? (isOpportunityQualified(qualification) ? 'qualified' : 'qualifying')
      : '',
    duration_seconds: duration_seconds || 0,
    started_at: started_at || '',
    ended_at: ended_at || now,
    call_provider: call_provider || 'manual',
    provider_call_id: provider_call_id || '',
    recording_url: recording_url || '',
    ...classifyCall(primaryOutcome, conversation_type),
    connected_at: outcomeRule.category === 'connected' ? (started_at || ended_at || now) : '',
    outcome_saved_at: now,
  };

  const callLog = await base44.asServiceRole.entities.CallLog.create(callLogData);

  // Persist territory / AM overrides onto the company when provided on IR
  if (company && outcome === 'connected_information_requested') {
    const companyPatch: Record<string, string> = {};
    if (territory && territory !== company.territory) companyPatch.territory = territory;
    if (account_manager_name && account_manager_name !== company.account_manager_name) {
      companyPatch.account_manager_name = account_manager_name;
    }
    if (account_manager_email && account_manager_email !== company.account_manager_email) {
      companyPatch.account_manager_email = account_manager_email;
    }
    if (Object.keys(companyPatch).length) {
      await base44.asServiceRole.entities.Company.update(company.id, companyPatch).catch(() => null);
    }
  }

  // 8. Complete the originating task
  if (task && outcomeRule.closes_current_task) {
    await base44.asServiceRole.entities.Task.update(task.id, {
      status: 'completed',
      completed_at: now,
      locked_by_user_id: '',
      locked_at: undefined,
    });
  }

  // 9. Update Contact status
  if (contact) {
    const contactPatch = {
      last_called: now,
      call_count: (contact.call_count || 0) + 1,
    };

    if (primaryOutcome === 'do_not_call') {
      contactPatch.number_status = 'dnc';
      contactPatch.call_status = 'not_interested';
      // Flagged immediately, so the contact is undiallable even if the erasure
      // below cannot complete.
      contactPatch.do_not_call = true;
      contactPatch.marketing_status = 'suppressed';
      contactPatch.suppression_scope = 'contact';
    } else if (outcome === 'invalid_number') {
      contactPatch.number_status = 'bad';
      contactPatch.call_status = 'attempted';
    } else if (outcomeRule.category === 'connected') {
      if (outcome === 'connected_interested' || outcome === 'connected_qualified') {
        contactPatch.call_status = 'interested';
      } else if (outcome === 'connected_callback') {
        contactPatch.call_status = 'callback';
      } else if (outcome === 'connected_not_interested') {
        contactPatch.call_status = 'not_interested';
      } else {
        contactPatch.call_status = 'connected';
      }
      if (contact.number_status === 'untested') contactPatch.number_status = 'good';
    } else if (outcomeRule.category === 'no_answer') {
      contactPatch.call_status = 'attempted';
      if (contact.number_status === 'untested') contactPatch.number_status = 'good';
    }

    // Only client-facing notes land on the Contact record (reports/handoffs).
    if (clientFacingNotes) {
      contactPatch.notes = contact.notes
        ? contact.notes + ' | ' + clientFacingNotes
        : clientFacingNotes;
    }

    await base44.asServiceRole.entities.Contact.update(contact.id, contactPatch);
  }

  // 9b. Do not call: the person asked not to be called, so their details are
  // erased from the system and only the suppression flag is kept.
  if (contact && primaryOutcome === 'do_not_call') {
    await processDoNotCall(
      base44, user, org, contact.id,
      internalFacingNotes || clientFacingNotes || 'Asked not to be called',
      'caller',
    ).catch((error) => console.error('do_not_call erasure failed', contact.id, error?.message || error));
  }

  // 10. Check suppression before creating follow-up
  let suppressedReason = null;
  if (contact && outcomeRule.requires_follow_up && !outcomeRule.suppresses_future_calls) {
    if (isMaxAttemptsReached(contact, settings)) {
      suppressedReason = 'Maximum attempts reached';
    }
  }

  // 11. Create follow-up task if required and not suppressed
  let followUpTask = null;
  if (outcomeRule.requires_follow_up && followUpAt && !outcomeRule.suppresses_future_calls && !suppressedReason) {
    const refId = contact?.id || company?.id || task?.company_id;
    const idemKey = taskIdempotencyKey(org.id, followUpTaskType, refId);
    const existing = await findActiveByTaskKey(base44, org.id, idemKey);

    if (!existing) {
      const attemptNum = (task?.attempt_number || 1) + 1;
      followUpTask = await base44.asServiceRole.entities.Task.create({
        organisation_id: org.id,
        assigned_user_id: task?.assigned_user_id || '',
        created_by_user_id: user.id,
        target_list_id: campaign_id || task?.target_list_id || '',
        company_id: company?.id || task?.company_id || '',
        contact_id: contact?.id || task?.contact_id || '',
        task_type: followUpTaskType,
        title: followUpTaskType.replace(/_/g, ' ') + ' — ' + (company?.name || contact?.full_name || ''),
        status: 'pending',
        priority: 'normal',
        due_at: followUpAt,
        due_date: followUpAt.split('T')[0],
        source: 'call_outcome',
        source_reference: callLog.id,
        idempotency_key: idemKey,
        attempt_number: attemptNum,
        timezone: settings.timezone,
      });
    }
  }

  // 12. Create/update Opportunity if qualified
  let opportunity = null;
  if (outcomeRule.qualification_effect === 'create_opportunity') {
    const oppCompanyId = company?.id || task?.company_id || '';
    const oppContactId = contact?.id || task?.contact_id || '';
    if (oppCompanyId) {
      const existingOpps = await base44.asServiceRole.entities.Opportunity.filter({
        organisation_id: org.id, company_id: oppCompanyId,
      }, '-created_date', 5).catch(() => []);

      const qualStatus = isOpportunityQualified(qualification) ? 'qualified' : 'qualifying';
      const oppStage = qualStatus === 'qualified' ? 'qualified' : 'qualifying';

      const qualFields = {
        need_summary: qualification?.need || '',
        pain_points: qualification?.pain || '',
        current_solution: qualification?.current_solution || '',
        timing: qualification?.timing || '',
        budget_status: qualification?.budget || '',
        decision_makers: qualification?.decision_maker || '',
        decision_process: qualification?.decision_process || '',
        next_step: qualification?.next_step || '',
        next_step_at: followUpAt || '',
        estimated_value: qualification?.estimated_value || 0,
      };

      if (existingOpps && existingOpps[0]) {
        const merged = {};
        for (const [k, v] of Object.entries(qualFields)) {
          if (v) merged[k] = v;
        }
        opportunity = await base44.asServiceRole.entities.Opportunity.update(existingOpps[0].id, {
          stage: oppStage,
          qualification_status: qualStatus,
          source_call_log_id: callLog.id,
          ...merged,
        });
      } else {
        opportunity = await base44.asServiceRole.entities.Opportunity.create({
          organisation_id: org.id,
          company_id: oppCompanyId,
          primary_contact_id: oppContactId,
          campaign_id: campaign_id || task?.target_list_id || '',
          owner_user_id: user.id,
          source_call_log_id: callLog.id,
          name: (company?.name || 'Opportunity') + ' — ' + (contact?.full_name || ''),
          stage: oppStage,
          qualification_status: qualStatus,
          currency: 'GBP',
          handoff_status: 'not_ready',
          ...qualFields,
        });
      }
    }
  }

  // 13. Info requested → admin inbox (organisation_admin / platform_owner).
  // Callers with draft permission may still save their own mailbox draft separately.
  let managerIrTask = null;
  if (primaryOutcome === 'connected_information_requested') {
    try {
      let adminUserId = '';
      const admins = await base44.asServiceRole.entities.UserProfile.filter(
        { organisation_id: org.id, app_role: 'organisation_admin', status: 'active' }, '-created_date', 10,
      ).catch(() => []);
      adminUserId = admins?.[0]?.user_id || '';
      if (!adminUserId) {
        const owners = await base44.asServiceRole.entities.UserProfile.filter(
          { organisation_id: org.id, app_role: 'platform_owner', status: 'active' }, '-created_date', 5,
        ).catch(() => []);
        adminUserId = owners?.[0]?.user_id || '';
      }
      // Last resort: managing BDM, so the IR is never dropped.
      if (!adminUserId) {
        const callerProfiles = await base44.asServiceRole.entities.UserProfile.filter(
          { organisation_id: org.id, user_id: user.id }, '-created_date', 1,
        ).catch(() => []);
        adminUserId = callerProfiles?.[0]?.managed_by_user_id || '';
      }
      if (!adminUserId) {
        const managers = await base44.asServiceRole.entities.UserProfile.filter(
          { organisation_id: org.id, app_role: 'sales_manager', status: 'active' }, '-created_date', 5,
        ).catch(() => []);
        adminUserId = managers?.[0]?.user_id || '';
      }

      const topic = info_request_topic || 'Information requested';
      managerIrTask = await base44.asServiceRole.entities.Task.create({
        organisation_id: org.id,
        assigned_user_id: adminUserId,
        created_by_user_id: user.id,
        target_list_id: campaign_id || task?.target_list_id || '',
        company_id: company?.id || task?.company_id || '',
        contact_id: contact?.id || task?.contact_id || '',
        call_log_id: callLog.id,
        task_type: 'info_request_followup',
        title: `IR draft — ${company?.name || contact?.full_name || 'prospect'}`,
        description: [
          topic,
          clientFacingNotes ? `Client notes: ${clientFacingNotes}` : '',
          account_manager_name ? `AM: ${account_manager_name}` : '',
          territory ? `Territory: ${territory}` : '',
        ].filter(Boolean).join('\n'),
        status: 'pending',
        priority: 'high',
        due_at: followUpAt || now,
        due_date: (followUpAt || now).toString().slice(0, 10),
        source: 'call_outcome',
        source_reference: callLog.id,
        timezone: settings.timezone,
      });

      if (adminUserId) {
        try {
          await base44.asServiceRole.entities.Notice.create({
            organisation_id: org.id,
            user_id: adminUserId,
            type: 'info_request',
            title: 'New information request',
            body: `${profile.full_name || user.email || 'A caller'} logged an IR for ${company?.name || contact?.full_name || 'a prospect'}. Open Admin inbox to draft the reply.`,
            related_entity_type: 'Task',
            related_entity_id: managerIrTask.id,
            created_at: now,
          });
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal */ }
  }

  // 14. Create audit records (non-fatal)
  const auditBase = { organisation_id: org.id, actor_user_id: user.id, timestamp: now };
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      ...auditBase, action: 'outcome_submitted', entity_type: 'CallLog', entity_id: callLog.id, new_value: outcome,
    });
    if (followUpTask) {
      await base44.asServiceRole.entities.AuditLog.create({
        ...auditBase, action: 'callback_created', entity_type: 'Task', entity_id: followUpTask.id, new_value: followUpTask.due_at,
      });
    }
    if (managerIrTask) {
      await base44.asServiceRole.entities.AuditLog.create({
        ...auditBase, action: 'info_request_to_manager', entity_type: 'Task', entity_id: managerIrTask.id, new_value: outcome,
      });
    }
    if (outcomeRule.suppresses_contact && contact) {
      await base44.asServiceRole.entities.AuditLog.create({
        ...auditBase, action: 'contact_suppressed', entity_type: 'Contact', entity_id: contact.id, new_value: outcome,
      });
    }
    if (opportunity) {
      await base44.asServiceRole.entities.AuditLog.create({
        ...auditBase, action: 'opportunity_created', entity_type: 'Opportunity', entity_id: opportunity.id, new_value: opportunity.stage,
      });
    }
  } catch { /* audit failures are non-fatal */ }

  // 15. Return result
  return Response.json({
    success: true,
    call_log: { id: callLog.id, primary_outcome: primaryOutcome, outcome },
    follow_up_task: followUpTask ? { id: followUpTask.id, due_at: followUpTask.due_at, task_type: followUpTask.task_type } : null,
    manager_ir_task: managerIrTask ? { id: managerIrTask.id, assigned_user_id: managerIrTask.assigned_user_id } : null,
    opportunity: opportunity ? { id: opportunity.id, stage: opportunity.stage, qualification_status: opportunity.qualification_status } : null,
    suppressed: suppressedReason,
  });
}