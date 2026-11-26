import { resolveTenant } from '../../shared/tenantAuth.ts';
import { buildTodayWork } from '../../shared/todayWork.ts';

// Returns the prioritised today-work view for the calling user.
// Includes task sections (due_now, overdue, previous_conversations,
// new_prospects, needs_review), needs_scheduling contacts, and daily
// performance stats. No AI, no integration credits.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  const body = await req.json().catch(() => ({}));
  const work = await buildTodayWork(base44, { user, profile, org, campaignId: body?.campaign_id || '' });
  return Response.json(work);
}