// ResearchJob lifecycle helpers. Prevents simultaneous duplicate jobs of the
// same type for the same target list via an idempotency key.

function key(target_list_id, job_type) {
  return `${target_list_id}:${job_type}`;
}

// Returns an active (queued/processing) job of this type for the list, if any.
export async function findActiveJob(base44, organisation_id, target_list_id, job_type) {
  const jobs = await base44.asServiceRole.entities.ResearchJob.filter(
    { organisation_id, target_list_id, job_type, idempotency_key: key(target_list_id, job_type) },
    '-created_date', 10
  );
  return jobs.find((j) => j.status === 'queued' || j.status === 'processing') || null;
}

export async function createJob(base44, { organisation_id, target_list_id, requested_by_user_id, job_type, total_records, estimated_cost }) {
  return base44.asServiceRole.entities.ResearchJob.create({
    organisation_id, target_list_id, requested_by_user_id, job_type,
    status: 'queued', total_records: total_records || 0, processed_records: 0,
    successful_records: 0, failed_records: 0, skipped_records: 0,
    estimated_cost: estimated_cost || 0, actual_cost: 0,
    idempotency_key: key(target_list_id, job_type),
  });
}

export async function startJob(base44, job) {
  return base44.asServiceRole.entities.ResearchJob.update(job.id, {
    status: 'processing', started_at: new Date().toISOString(),
  });
}

export async function completeJob(base44, job, counts) {
  const ok = counts.successful;
  const fail = counts.failed;
  const status = fail === 0 ? 'completed' : (ok === 0 ? 'failed' : 'partially_completed');
  return base44.asServiceRole.entities.ResearchJob.update(job.id, {
    status, processed_records: counts.processed, successful_records: ok,
    failed_records: fail, skipped_records: counts.skipped,
    actual_cost: counts.actualCost, completed_at: new Date().toISOString(),
    error_summary: (counts.errorSummary || '').slice(0, 1000),
  });
}

export async function recordAttempt(base44, attempt) {
  return base44.asServiceRole.entities.EnrichmentAttempt.create({
    organisation_id: attempt.organisation_id,
    target_list_id: attempt.target_list_id,
    company_id: attempt.company_id,
    contact_id: attempt.contact_id,
    prospect_id: attempt.prospect_id,
    research_job_id: attempt.research_job_id,
    provider: attempt.provider,
    enrichment_type: attempt.enrichment_type,
    status: attempt.status || 'pending',
    provider_reference: attempt.provider_reference || '',
    source_url: attempt.source_url || '',
    confidence: attempt.confidence || 0,
    fields_returned: attempt.fields_returned || [],
    estimated_cost: attempt.estimated_cost || 0,
    actual_cost: attempt.actual_cost || 0,
    attempted_at: new Date().toISOString(),
    expires_at: attempt.expires_at || '',
    error_code: attempt.error_code || '',
    safe_error_message: (attempt.safe_error_message || '').slice(0, 1000),
  });
}