import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';

// Submit product feedback from any page.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const body = await req.json().catch(() => ({}));
    const { feedback_type, title, description, page, expected_behaviour, current_behaviour, frequency, impact, workaround } = body;

    if (!title || !feedback_type) {
      return Response.json({ error: 'Title and feedback type are required.' }, { status: 400 });
    }

    const feedback = await base44.asServiceRole.entities.ProductFeedback.create({
      organisation_id: org.id,
      submitted_by_user_id: user.id,
      user_role: profile.role || 'user',
      feedback_type,
      page: page || '',
      title,
      description: description || '',
      expected_behaviour: expected_behaviour || '',
      current_behaviour: current_behaviour || '',
      frequency: frequency || 'once',
      impact: impact || 'minor',
      workaround: workaround || '',
      status: 'new',
      product_area: body.product_area || 'other',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return Response.json({
      id: feedback.id,
      status: 'created',
      message: 'Thank you — your feedback has been recorded and will be reviewed.',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}