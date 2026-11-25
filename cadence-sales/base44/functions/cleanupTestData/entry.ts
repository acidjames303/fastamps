import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';

// Safe cleanup — deletes ONLY records matching the explicit test_run_id.
// Never uses a broad delete query. Never deletes real customer data.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const body = await req.json().catch(() => ({}));
    const test_run_id = body.test_run_id;

    if (!test_run_id) {
      return Response.json({ error: 'test_run_id is required.' }, { status: 400 });
    }

    // Delete only records explicitly marked with this test_run_id.
    // Each filter includes organisation_id as a safety boundary.
    const results = await Promise.all([
      base44.asServiceRole.entities.Contact.deleteMany({
        organisation_id: org.id,
        data_source: 'test_data',
        source_import_id: test_run_id,
      }).catch(() => 0),
      base44.asServiceRole.entities.Company.deleteMany({
        organisation_id: org.id,
        data_source: 'test_data',
        source_reference: test_run_id,
      }).catch(() => 0),
      base44.asServiceRole.entities.Task.deleteMany({
        organisation_id: org.id,
        source_reference: test_run_id,
      }).catch(() => 0),
      base44.asServiceRole.entities.CallLog.deleteMany({
        organisation_id: org.id,
        provider_call_id: test_run_id,
      }).catch(() => 0),
    ]);

    const extractCount = (r) => {
      if (typeof r === 'number') return r;
      if (r && typeof r === 'object') return r.deleted_count || r.count || r.deleted || 0;
      return 0;
    };

    return Response.json({
      test_run_id,
      deleted: {
        contacts: extractCount(results[0]),
        companies: extractCount(results[1]),
        tasks: extractCount(results[2]),
        call_logs: extractCount(results[3]),
      },
      message: 'Test data cleanup complete.',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}