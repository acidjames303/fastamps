import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';

// Test data harness — creates clearly marked test records for capacity/volume testing.
// All records are marked with data_source: 'test_data' and a test_run_id so cleanup
// can delete only those records. Never creates real paid calls or external writes.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const body = await req.json().catch(() => ({}));
    const profile_key = body.profile || 'micro';
    const test_run_id = body.test_run_id || `test-${Date.now()}`;
    const now = new Date().toISOString();

    const profiles = {
      micro: { companies: 10, contacts: 20, callLogs: 10, tasks: 5 },
      small: { companies: 50, contacts: 100, callLogs: 50, tasks: 25 },
    };
    const c = profiles[profile_key] || profiles.micro;

    // Create test companies
    const companiesData = Array.from({ length: c.companies }, (_, i) => ({
      name: `[TEST] Company ${i + 1}`,
      domain: `test-${test_run_id}-${i + 1}.example.com`,
      website: `https://test-${i + 1}.example.com`,
      industry: ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail'][i % 5],
      employee_range: '11-50',
      location: 'London, United Kingdom',
      country: 'United Kingdom',
      organisation_id: org.id,
      owner_user_id: user.id,
      data_source: 'test_data',
      source_reference: test_run_id,
    }));
    const createdCompanies = await base44.asServiceRole.entities.Company.bulkCreate(companiesData);

    // Create test contacts linked to the test companies
    const contactsData = Array.from({ length: c.contacts }, (_, i) => ({
      full_name: `[TEST] Contact ${i + 1}`,
      phone: `0712345${String(i + 1).padStart(4, '0')}`,
      email: `test-${i + 1}@test-data.example`,
      company: createdCompanies[i % c.companies].name,
      company_id: createdCompanies[i % c.companies].id,
      organisation_id: org.id,
      owner_user_id: user.id,
      data_source: 'test_data',
      source_import_id: test_run_id,
      source: 'manual',
      call_status: 'new',
      number_status: 'untested',
      marketing_status: 'unknown',
      business_contact: true,
    }));
    const createdContacts = await base44.asServiceRole.entities.Contact.bulkCreate(contactsData);

    // Create test call logs (no real calls — mock data only)
    const outcomes = ['no_answer', 'voicemail', 'connected_not_interested', 'connected_callback'];
    const logsData = Array.from({ length: c.callLogs }, (_, i) => ({
      contact_id: createdContacts[i % c.contacts].id,
      contact_name: createdContacts[i % c.contacts].full_name,
      company: createdCompanies[i % c.companies].name,
      company_id: createdCompanies[i % c.companies].id,
      phone: createdContacts[i % c.contacts].phone,
      outcome: outcomes[i % outcomes.length],
      primary_outcome: outcomes[i % outcomes.length],
      organisation_id: org.id,
      user_id: user.id,
      assigned_user_id: user.id,
      provider_call_id: test_run_id,
      notes: `[TEST:${test_run_id}] Mock call log ${i + 1}`,
      started_at: now,
      ended_at: now,
      duration_seconds: 0,
    }));
    const createdLogs = await base44.asServiceRole.entities.CallLog.bulkCreate(logsData);

    // Create test tasks
    const tasksData = Array.from({ length: c.tasks }, (_, i) => ({
      organisation_id: org.id,
      assigned_user_id: user.id,
      contact_id: createdContacts[i % c.contacts].id,
      company_id: createdCompanies[i % c.companies].id,
      task_type: i % 2 === 0 ? 'new_call' : 'callback',
      title: `[TEST] Task ${i + 1}`,
      status: 'pending',
      priority: 'normal',
      source: 'user',
      source_reference: test_run_id,
      due_at: now,
      due_date: now.split('T')[0],
      timezone: org.timezone || 'Europe/London',
    }));
    const createdTasks = await base44.asServiceRole.entities.Task.bulkCreate(tasksData);

    return Response.json({
      test_run_id,
      profile: profile_key,
      created: {
        companies: createdCompanies.length,
        contacts: createdContacts.length,
        call_logs: createdLogs.length,
        tasks: createdTasks.length,
      },
      message: 'Test data created. Run cleanupTestData with this test_run_id to remove all records.',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}