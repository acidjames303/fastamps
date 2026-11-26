import { resolveTenant } from '../../shared/tenantAuth.ts';
import { CANONICAL_ORGANISATION_ID } from '../../shared/tenantConfig.ts';
import {
  pickWritableFields,
  computeMissingFields,
  changedFieldKeys,
  canTransition,
  canEditSheet,
  canReviewRole,
  missingRequiredToSubmit,
  idempotencyKey,
} from '../../shared/leadSheet.ts';

// One place for every lead sheet mutation: create a draft from a call or an
// opportunity, autosave edits, submit, review (approve / return), mark sent and
// attach a generated file. Tenant and role are resolved server-side; nothing is
// ever sent to a client from here.
export default async function (req: Request): Promise<Response> {
  try {
    const { base44, user, profile } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const role = profile.app_role;
    const entities = base44.asServiceRole.entities;
    const actor = user.full_name || user.email || '';
    const now = new Date().toISOString();

    const loadSheet = async (id: string) => {
      if (!id) return null;
      const rows = await entities.LeadSheet.filter({
        id,
        organisation_id: CANONICAL_ORGANISATION_ID,
      });
      return (rows && rows[0]) || null;
    };

    if (action === 'create') {
      const source = ['dialer', 'opportunity', 'manual'].includes(body.source) ? body.source : 'dialer';
      const callLogId = String(body.call_log_id || '');
      const opportunityId = String(body.opportunity_id || '');
      const key = idempotencyKey(source, callLogId, opportunityId);

      if (key) {
        const existing = await entities.LeadSheet.filter({
          organisation_id: CANONICAL_ORGANISATION_ID,
          idempotency_key: key,
        });
        if (existing && existing[0]) {
          return Response.json({ sheet: existing[0], created: false });
        }
      }

      const fields = pickWritableFields(body.fields);
      // Internal notes are never drafted from a call or opportunity.
      fields.internal_notes = '';

      const record: Record<string, any> = {
        organisation_id: CANONICAL_ORGANISATION_ID,
        status: 'draft',
        source,
        idempotency_key: key,
        call_log_id: callLogId,
        opportunity_id: opportunityId,
        campaign_id: String(body.campaign_id || ''),
        contact_id: String(body.contact_id || ''),
        prospect_id: String(body.prospect_id || ''),
        company_id: String(body.company_id || ''),
        caller_user_id: user.id,
        caller_name: actor,
        assigned_bdm_user_id: String(body.assigned_bdm_user_id || ''),
        ...fields,
        prefilled_fields: Array.isArray(body.prefilled_fields)
          ? body.prefilled_fields.filter((field: any) => typeof field === 'string').slice(0, 60)
          : [],
        revisions: [{
          at: now,
          by_user_id: user.id,
          by_name: actor,
          action: 'created',
          from_status: '',
          to_status: 'draft',
          note: source === 'opportunity' ? 'Drafted from the opportunity' : 'Drafted from the call',
        }],
        last_saved_at: now,
        last_saved_by_user_id: user.id,
      };
      record.missing_fields = computeMissingFields(record);

      const created = await entities.LeadSheet.create(record);
      return Response.json({ sheet: created, created: true });
    }

    if (action === 'save') {
      const sheet = await loadSheet(String(body.id || ''));
      if (!sheet) return Response.json({ error: 'Lead sheet not found.' }, { status: 404 });
      if (!canEditSheet(sheet, user.id, role)) {
        return Response.json(
          { error: 'Only the caller can change this lead sheet while it is a draft or returned.' },
          { status: 403 },
        );
      }
      const fields = pickWritableFields(body.fields);
      const merged = { ...sheet, ...fields };
      const updated = await entities.LeadSheet.update(sheet.id, {
        ...fields,
        missing_fields: computeMissingFields(merged),
        last_saved_at: now,
        last_saved_by_user_id: user.id,
      });
      return Response.json({ sheet: updated, changed_fields: changedFieldKeys(sheet, merged) });
    }

    if (action === 'submit') {
      const sheet = await loadSheet(String(body.id || ''));
      if (!sheet) return Response.json({ error: 'Lead sheet not found.' }, { status: 404 });
      if (sheet.caller_user_id !== user.id && role !== 'platform_owner') {
        return Response.json({ error: 'Only the caller can submit this lead sheet.' }, { status: 403 });
      }
      if (!canTransition(sheet.status, 'submitted')) {
        return Response.json({ error: `A ${sheet.status} lead sheet cannot be submitted.` }, { status: 400 });
      }
      const fields = pickWritableFields(body.fields);
      const merged = { ...sheet, ...fields };
      const missing = missingRequiredToSubmit(merged);
      if (missing.length) {
        return Response.json(
          { error: `Add ${missing.join(', ')} before submitting.`, missing },
          { status: 400 },
        );
      }
      const updated = await entities.LeadSheet.update(sheet.id, {
        ...fields,
        status: 'submitted',
        submitted_at: now,
        missing_fields: computeMissingFields(merged),
        last_saved_at: now,
        last_saved_by_user_id: user.id,
        revisions: [...(sheet.revisions || []), {
          at: now,
          by_user_id: user.id,
          by_name: actor,
          action: 'submitted',
          from_status: sheet.status,
          to_status: 'submitted',
          changed_fields: changedFieldKeys(sheet, merged),
        }],
      });
      return Response.json({ sheet: updated });
    }

    if (action === 'approve' || action === 'return') {
      const sheet = await loadSheet(String(body.id || ''));
      if (!sheet) return Response.json({ error: 'Lead sheet not found.' }, { status: 404 });
      if (!canReviewRole(role)) {
        return Response.json({ error: 'Your role cannot review lead sheets.' }, { status: 403 });
      }
      const target = action === 'approve' ? 'approved' : 'returned';
      if (!canTransition(sheet.status, target)) {
        return Response.json({ error: `A ${sheet.status} lead sheet cannot be ${target}.` }, { status: 400 });
      }
      const reason = String(body.reason || '').trim().slice(0, 2000);
      if (action === 'return' && !reason) {
        return Response.json({ error: 'Give the caller a reason for returning the sheet.' }, { status: 400 });
      }
      const decision = action === 'approve' ? 'approved' : 'returned';
      const updated = await entities.LeadSheet.update(sheet.id, {
        status: target,
        reviewer_user_id: user.id,
        reviewed_at: now,
        approved_at: action === 'approve' ? now : sheet.approved_at || '',
        review_history: [...(sheet.review_history || []), {
          at: now,
          reviewer_user_id: user.id,
          reviewer_name: actor,
          decision,
          reason,
        }],
        revisions: [...(sheet.revisions || []), {
          at: now,
          by_user_id: user.id,
          by_name: actor,
          action: decision,
          from_status: sheet.status,
          to_status: target,
          note: reason,
        }],
      });
      return Response.json({ sheet: updated });
    }

    if (action === 'mark_sent') {
      const sheet = await loadSheet(String(body.id || ''));
      if (!sheet) return Response.json({ error: 'Lead sheet not found.' }, { status: 404 });
      if (!canReviewRole(role)) {
        return Response.json({ error: 'Your role cannot mark a lead sheet as sent.' }, { status: 403 });
      }
      if (!canTransition(sheet.status, 'sent')) {
        return Response.json(
          { error: 'Approve the lead sheet before marking it as sent.' },
          { status: 400 },
        );
      }
      const updated = await entities.LeadSheet.update(sheet.id, {
        status: 'sent',
        sent_at: now,
        sent_by_user_id: user.id,
        reviewer_user_id: sheet.reviewer_user_id || user.id,
        revisions: [...(sheet.revisions || []), {
          at: now,
          by_user_id: user.id,
          by_name: actor,
          action: 'sent',
          from_status: sheet.status,
          to_status: 'sent',
          note: 'Marked sent after a manual download',
        }],
      });
      return Response.json({ sheet: updated });
    }

    if (action === 'attach_file') {
      const sheet = await loadSheet(String(body.id || ''));
      if (!sheet) return Response.json({ error: 'Lead sheet not found.' }, { status: 404 });
      const isOwner = sheet.caller_user_id === user.id;
      if (!isOwner && !canReviewRole(role)) {
        return Response.json({ error: 'You cannot attach a file to this lead sheet.' }, { status: 403 });
      }
      const uri = String(body.file_uri || '');
      if (!uri.startsWith('private/')) {
        return Response.json({ error: 'Lead sheet files must be stored privately.' }, { status: 400 });
      }
      const kind = body.file_kind === 'docx' ? 'docx' : 'pdf';
      const patch: Record<string, any> = {
        files_generated_at: now,
        revisions: [...(sheet.revisions || []), {
          at: now,
          by_user_id: user.id,
          by_name: actor,
          action: 'exported',
          from_status: sheet.status,
          to_status: sheet.status,
          note: `${kind.toUpperCase()} generated`,
        }],
      };
      if (kind === 'docx') patch.file_docx_uri = uri;
      else patch.file_pdf_uri = uri;
      const updated = await entities.LeadSheet.update(sheet.id, patch);
      return Response.json({ sheet: updated });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Lead sheet request failed.' }, { status: error?.status || 500 });
  }
}