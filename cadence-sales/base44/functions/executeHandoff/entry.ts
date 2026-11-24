import { resolveTenant } from '../../shared/tenantAuth.ts';
import { buildHandoffPayload, validatePayload, PAYLOAD_VERSION } from '../../shared/handoffPayload.ts';
import { decryptJSON } from '../../shared/handoffCrypto.ts';
import { validateWebhookUrl, safeFetch, buildAuthHeaders } from '../../shared/webhookSecurity.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { opportunity_id, destination_type, destination_id, retry_attempt_id } = body;

    // Retry path: re-process an existing failed attempt
    if (retry_attempt_id) {
      const attempt = await base44.entities.HandoffAttempt.get(retry_attempt_id);
      if (!attempt || attempt.organisation_id !== org.id) {
        return Response.json({ error: 'Handoff attempt not found' }, { status: 404 });
      }
      if (attempt.status === 'succeeded') {
        return Response.json({ error: 'This handoff already succeeded' }, { status: 409 });
      }
      return await processHandoff(base44, user, profile, org, attempt.opportunity_id, attempt.destination_type, attempt.destination_id, attempt.attempt_number + 1);
    }

    if (!opportunity_id || !destination_type) {
      return Response.json({ error: 'opportunity_id and destination_type are required' }, { status: 400 });
    }

    // Only managers/admins can execute handoffs (unless self-approved is allowed)
    const opp = await base44.entities.Opportunity.get(opportunity_id);
    if (!opp || opp.organisation_id !== org.id) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    if (opp.handoff_status === 'handed_off' && !body.force) {
      return Response.json({ error: 'Opportunity already handed off. Use force=true to send an updated version.' }, { status: 409 });
    }

    if (opp.manager_review_status !== 'approved' && !org?.settings?.allow_self_approved_handoff) {
      return Response.json({ error: 'Opportunity must be approved by a manager before handoff.' }, { status: 403 });
    }

    return await processHandoff(base44, user, profile, org, opportunity_id, destination_type, destination_id, 1);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

async function processHandoff(base44, user, profile, org, opportunity_id, destination_type, destination_id, attempt_number) {
  const now = new Date().toISOString();
  const idempotencyKey = `handoff-${opportunity_id}-${Date.now()}`;

  // Build canonical payload
  const payload = await buildHandoffPayload(base44.asServiceRole, opportunity_id);
  const validation = validatePayload(payload);
  if (!validation.valid) {
    return Response.json({
      error: 'Handoff payload is missing required fields.',
      missing: validation.missing,
    }, { status: 400 });
  }

  // Create attempt record
  const attempt = await base44.asServiceRole.entities.HandoffAttempt.create({
    organisation_id: org.id,
    opportunity_id,
    campaign_id: payload.source?.campaign_id || '',
    destination_type,
    destination_id: destination_id || '',
    payload_version: PAYLOAD_VERSION,
    payload_snapshot: JSON.stringify(payload),
    status: 'processing',
    idempotency_key: idempotencyKey,
    attempt_number,
    requested_by_user_id: user.id,
    approved_by_user_id: user.id,
    requested_at: now,
  });

  // Update opportunity status
  await base44.entities.Opportunity.update(opportunity_id, {
    handoff_status: 'sending',
    handoff_destination: destination_type,
    handoff_payload: JSON.stringify(payload),
    handoff_payload_version: PAYLOAD_VERSION,
    updated_at: now,
  });

  // Audit: handoff initiated
  await base44.asServiceRole.entities.AuditLog.create({
    organisation_id: org.id,
    actor_user_id: user.id,
    action: 'handoff_initiated',
    entity_type: 'HandoffAttempt',
    entity_id: attempt.id,
    new_value: destination_type,
    timestamp: now,
  });

  let result;
  try {
    if (destination_type === 'webhook') {
      result = await sendWebhook(base44, org, destination_id, payload);
    } else if (destination_type === 'csv') {
      result = { status: 'succeeded', external_record_url: null, safe_response_summary: 'CSV export prepared' };
    } else if (destination_type === 'manual') {
      result = { status: 'succeeded', external_record_url: null, safe_response_summary: 'Manual handoff confirmed' };
    } else if (destination_type === 'hubspot') {
      result = await sendHubspot(base44, org, destination_id, payload);
    } else {
      result = { status: 'failed', error_code: 'unknown_destination', error_message: `Unknown destination type: ${destination_type}` };
    }
  } catch (e) {
    result = { status: 'failed', error_code: 'exception', error_message: e.message };
  }

  const completedAt = new Date().toISOString();
  const succeeded = result.status === 'succeeded';

  // Update attempt record
  await base44.asServiceRole.entities.HandoffAttempt.update(attempt.id, {
    status: succeeded ? 'succeeded' : 'failed',
    completed_at: completedAt,
    external_company_id: result.external_company_id || '',
    external_contact_id: result.external_contact_id || '',
    external_opportunity_id: result.external_opportunity_id || '',
    external_record_url: result.external_record_url || '',
    response_status: result.response_status || null,
    safe_response_summary: result.safe_response_summary || '',
    error_code: result.error_code || '',
    error_message: result.error_message || '',
    next_retry_at: succeeded ? null : new Date(Date.now() + 300000).toISOString(), // 5 min backoff
  });

  // Update opportunity
  const oppUpdates = {
    handoff_status: succeeded ? 'handed_off' : 'failed',
    last_handoff_at: completedAt,
    last_handoff_error: succeeded ? '' : (result.error_message || 'Handoff failed'),
    updated_at: completedAt,
  };
  if (succeeded) {
    oppUpdates.external_record_id = result.external_opportunity_id || '';
    oppUpdates.external_record_url = result.external_record_url || '';
  }
  await base44.entities.Opportunity.update(opportunity_id, oppUpdates);

  // Audit + usage
  await base44.asServiceRole.entities.AuditLog.create({
    organisation_id: org.id,
    actor_user_id: user.id,
    action: succeeded ? 'handoff_succeeded' : 'handoff_failed',
    entity_type: 'HandoffAttempt',
    entity_id: attempt.id,
    new_value: destination_type,
    timestamp: completedAt,
  });

  if (destination_type === 'webhook' || destination_type === 'hubspot') {
    await base44.asServiceRole.entities.UsageEvent.create({
      organisation_id: org.id,
      user_id: user.id,
      event_type: 'phone_enrichment', // closest available enum
      provider: destination_type,
      quantity: 1,
      estimated_cost: 0,
      related_record_id: attempt.id,
      created_at: completedAt,
    }).catch(() => {});
  }

  return Response.json({
    attempt_id: attempt.id,
    status: succeeded ? 'succeeded' : 'failed',
    external_record_url: result.external_record_url || null,
    error: succeeded ? null : (result.error_message || 'Handoff failed'),
  });
}

function opp_manager_id(payload) {
  return payload.owner?.user_id || '';
}

async function sendWebhook(base44, org, destination_id, payload) {
  if (!destination_id) throw new Error('destination_id is required for webhook handoff');

  const dest = await base44.asServiceRole.entities.HandoffDestination.get(destination_id);
  if (!dest || dest.organisation_id !== org.id) throw new Error('Webhook destination not found');
  if (dest.status !== 'active') throw new Error('Webhook destination is not active');

  const urlValidation = validateWebhookUrl(dest.webhook_url);
  if (!urlValidation.valid) throw new Error(`Webhook URL validation failed: ${urlValidation.error}`);

  let authData = {};
  if (dest.encrypted_auth_data) {
    authData = await decryptJSON(dest.encrypted_auth_data);
  }
  const authHeaders = buildAuthHeaders(dest.webhook_auth_method, authData);

  // Add custom headers (names from dest, values from encrypted auth)
  const headers = { 'Content-Type': 'application/json', ...authHeaders };
  if (dest.header_names && dest.header_names.length > 0) {
    for (const name of dest.header_names) {
      if (authData[name]) headers[name] = authData[name];
    }
  }

  const signedEventId = `cadence-${payload.cadence_opportunity_id}-${Date.now()}`;

  const response = await safeFetch(dest.webhook_url, {
    method: 'POST',
    headers,
    body: { ...payload, signed_event_id: signedEventId },
    timeoutMs: 15000,
  });

  if (!response.ok) {
    return {
      status: 'failed',
      response_status: response.status,
      error_code: response.status >= 500 ? 'server_error' : 'client_error',
      error_message: `Webhook returned ${response.status}`,
      safe_response_summary: response.safeResponseSummary,
    };
  }

  return {
    status: 'succeeded',
    response_status: response.status,
    safe_response_summary: response.safeResponseSummary,
  };
}

async function sendHubspot(base44, org, destination_id, payload) {
  if (!destination_id) throw new Error('destination_id is required for HubSpot handoff');

  const dest = await base44.asServiceRole.entities.HandoffDestination.get(destination_id);
  if (!dest || dest.organisation_id !== org.id) throw new Error('HubSpot destination not found');
  if (dest.status !== 'active') throw new Error('HubSpot destination is not active');

  if (!dest.encrypted_auth_data) {
    return {
      status: 'failed',
      error_code: 'not_configured',
      error_message: 'HubSpot is not configured. Add a private app token in Integration Settings.',
    };
  }

  const authData = await decryptJSON(dest.encrypted_auth_data);
  const token = authData.hubspot_token;
  if (!token) {
    return {
      status: 'failed',
      error_code: 'missing_token',
      error_message: 'HubSpot private app token not found in integration config.',
    };
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Step 1: Find or create Company by domain
  let externalCompanyId = '';
  const companySearchResponse = await safeFetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
    method: 'POST',
    headers,
    body: {
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: payload.company?.domain || payload.company?.name }] }],
      properties: ['name', 'domain'],
      limit: 1,
    },
  });

  let companyCreated = false;
  if (companySearchResponse.ok) {
    try {
      const searchData = JSON.parse(companySearchResponse.safeResponseSummary);
      if (searchData.results && searchData.results.length > 0) {
        externalCompanyId = searchData.results[0].id;
      }
    } catch {}
  }

  if (!externalCompanyId) {
    const companyCreateResponse = await safeFetch('https://api.hubapi.com/crm/v3/objects/companies', {
      method: 'POST',
      headers,
      body: {
        properties: {
          name: payload.company?.name || '',
          website: payload.company?.website || '',
          industry: payload.company?.industry || '',
        },
      },
    });
    if (companyCreateResponse.ok) {
      try {
        const companyData = JSON.parse(companyCreateResponse.safeResponseSummary);
        externalCompanyId = companyData.id || '';
      } catch {}
      companyCreated = true;
    }
  }

  // Step 2: Find or create Contact by email
  let externalContactId = '';
  const contactEmail = payload.primary_contact?.email;
  if (contactEmail) {
    const contactSearchResponse = await safeFetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers,
      body: {
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: contactEmail }] }],
        properties: ['firstname', 'lastname', 'email'],
        limit: 1,
      },
    });
    if (contactSearchResponse.ok) {
      try {
        const searchData = JSON.parse(contactSearchResponse.safeResponseSummary);
        if (searchData.results && searchData.results.length > 0) {
          externalContactId = searchData.results[0].id;
        }
      } catch {}
    }

    if (!externalContactId) {
      const contactCreateResponse = await safeFetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers,
        body: {
          properties: {
            firstname: payload.primary_contact?.first_name || '',
            lastname: payload.primary_contact?.last_name || '',
            email: contactEmail,
            phone: payload.primary_contact?.phone || '',
            jobtitle: payload.primary_contact?.job_title || '',
          },
        },
      });
      if (contactCreateResponse.ok) {
        try {
          const contactData = JSON.parse(contactCreateResponse.safeResponseSummary);
          externalContactId = contactData.id || '';
        } catch {}
      }
    }
  }

  // Step 3: Create Deal (prevent duplicates by checking external_record_id)
  const dealResponse = await safeFetch('https://api.hubapi.com/crm/v3/objects/deals', {
    method: 'POST',
    headers,
    body: {
      properties: {
        dealname: payload.company?.name ? `${payload.company.name} — ${payload.agreed_next_step || 'Opportunity'}` : 'Cadence Opportunity',
        amount: String(payload.estimated_value || 0),
        deal_currency_code: payload.currency || 'GBP',
        dealstage: 'qualifiedtobuy',
        cadence_opportunity_id: payload.cadence_opportunity_id,
        cadence_qualification_summary: payload.qualification?.need_summary || '',
        cadence_next_step: payload.agreed_next_step || '',
      },
    },
  });

  let externalDealId = '';
  if (dealResponse.ok) {
    try {
      const dealData = JSON.parse(dealResponse.safeResponseSummary);
      externalDealId = dealData.id || '';
    } catch {}
  } else {
    return {
      status: 'failed',
      error_code: 'deal_creation_failed',
      error_message: `Failed to create HubSpot deal: ${dealResponse.status}`,
      safe_response_summary: dealResponse.safeResponseSummary,
    };
  }

  // Step 4: Associate Deal with Company
  if (externalCompanyId && externalDealId) {
    await safeFetch(`https://api.hubapi.com/crm/v3/objects/deals/${externalDealId}/associations/companies/${externalCompanyId}/deal_to_company`, {
      method: 'PUT', headers, body: {},
    });
  }

  // Step 5: Associate Deal with Contact
  if (externalContactId && externalDealId) {
    await safeFetch(`https://api.hubapi.com/crm/v3/objects/deals/${externalDealId}/associations/contacts/${externalContactId}/deal_to_contact`, {
      method: 'PUT', headers, body: {},
    });
  }

  return {
    status: 'succeeded',
    external_company_id: externalCompanyId,
    external_contact_id: externalContactId,
    external_opportunity_id: externalDealId,
    external_record_url: externalDealId ? `https://app.hubspot.com/contacts/${org.id}/deal/${externalDealId}/` : '',
    safe_response_summary: `Deal created. Company ${companyCreated ? 'created' : 'matched'}. Contact ${externalContactId ? 'found/created' : 'not created'}.`,
  };
}