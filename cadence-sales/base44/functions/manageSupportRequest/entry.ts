import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant, isPlatformOwner } from '../../shared/roleGuards.ts';

// Controlled support request management.
// CALLER: add a customer reply to own request (cannot change priority/status/assignment).
// ORG ADMIN: add organisation replies (cannot assign platform staff or mark resolved).
// PLATFORM OWNER: assign, change status, record workaround/resolution, close/reopen.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { action, request_id, reply_text, assigned_platform_user_id, new_status, workaround, resolution } = body;

    if (!action || !request_id) {
      return Response.json({ error: 'action and request_id are required.' }, { status: 400 });
    }

    const requests = await base44.asServiceRole.entities.SupportRequest.filter({ id: request_id });
    const request = requests && requests[0];
    if (!request) {
      return Response.json({ error: 'Support request not found.' }, { status: 404 });
    }

    // Org scoping: non-platform users can only access their own org's requests.
    if (!isPlatformOwner(profile) && request.organisation_id !== org.id) {
      return Response.json({ error: 'Access denied.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now };

    if (action === 'reply') {
      if (!isPlatformOwner(profile)) {
        if (request.submitted_by_user_id !== user.id && profile.app_role !== 'organisation_admin') {
          return Response.json({ error: 'You can only reply to your own requests.' }, { status: 403 });
        }
      }
      if (!reply_text) {
        return Response.json({ error: 'reply_text is required.' }, { status: 400 });
      }
      const replyBlock = `\n\n--- Reply from ${user.full_name || 'User'} (${profile.app_role}) at ${now} ---\n${reply_text}`;
      updates.description = (request.description || '') + replyBlock;
    } else if (action === 'assign') {
      if (!isPlatformOwner(profile)) return Response.json({ error: 'Only platform owners can assign requests.' }, { status: 403 });
      updates.assigned_platform_user_id = assigned_platform_user_id;
      if (!request.first_response_at) updates.first_response_at = now;
    } else if (action === 'update_status') {
      if (!isPlatformOwner(profile)) return Response.json({ error: 'Only platform owners can change status.' }, { status: 403 });
      updates.status = new_status;
      if (new_status === 'investigating' && !request.first_response_at) updates.first_response_at = now;
    } else if (action === 'resolve') {
      if (!isPlatformOwner(profile)) return Response.json({ error: 'Only platform owners can resolve requests.' }, { status: 403 });
      updates.status = 'resolved';
      updates.resolution = resolution || '';
      updates.resolved_at = now;
    } else if (action === 'close') {
      if (!isPlatformOwner(profile)) return Response.json({ error: 'Only platform owners can close requests.' }, { status: 403 });
      updates.status = 'closed';
      updates.closed_at = now;
    } else if (action === 'reopen') {
      if (!isPlatformOwner(profile)) return Response.json({ error: 'Only platform owners can reopen requests.' }, { status: 403 });
      updates.status = 'investigating';
      updates.reopened_count = (request.reopened_count || 0) + 1;
    } else if (action === 'set_workaround') {
      if (!isPlatformOwner(profile)) return Response.json({ error: 'Only platform owners can set workarounds.' }, { status: 403 });
      updates.workaround = workaround || '';
    } else {
      return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }

    await base44.asServiceRole.entities.SupportRequest.update(request_id, updates);
    return Response.json({ ok: true, action, status: updates.status || request.status });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}