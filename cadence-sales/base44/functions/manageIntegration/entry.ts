import { resolveTenant } from '../../shared/tenantAuth.ts';
import { encryptJSON, decryptJSON, maskValue } from '../../shared/handoffCrypto.ts';
import { validateWebhookUrl, safeFetch, buildAuthHeaders } from '../../shared/webhookSecurity.ts';
import { buildHandoffPayload } from '../../shared/handoffPayload.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Only org admins can manage integrations
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Only organisation admins can manage integrations.' }, { status: 403 });
    }

    if (action === 'list') {
      const destinations = await base44.asServiceRole.entities.HandoffDestination.filter(
        { organisation_id: org.id }, '-updated_date', 50,
      ).catch(() => []);

      // Never return encrypted data
      const safe = (destinations || []).map((d) => ({
        id: d.id,
        destination_type: d.destination_type,
        name: d.name,
        status: d.status,
        webhook_url: d.webhook_url || '',
        webhook_auth_method: d.webhook_auth_method || 'none',
        masked_auth_identifiers: d.masked_auth_identifiers || {},
        header_names: d.header_names || [],
        field_mapping: d.field_mapping || {},
        allowed_campaign_ids: d.allowed_campaign_ids || [],
        default_owner_mapping: d.default_owner_mapping || '',
        test_mode: d.test_mode || false,
        last_test_status: d.last_test_status || 'untested',
        last_test_at: d.last_test_at || '',
        last_test_error: d.last_test_error || '',
        last_success_at: d.last_success_at || '',
        last_failure_at: d.last_failure_at || '',
        updated_at: d.updated_at || '',
      }));

      return Response.json({ destinations: safe });
    }

    if (action === 'save') {
      const { destination_id, destination_type, name, webhook_url, webhook_auth_method, auth_credentials, header_names, field_mapping, allowed_campaign_ids, default_owner_mapping, test_mode } = body;

      if (!destination_type || !name) {
        return Response.json({ error: 'destination_type and name are required' }, { status: 400 });
      }

      // Validate webhook URL if provided
      if (webhook_url) {
        const urlValidation = validateWebhookUrl(webhook_url);
        if (!urlValidation.valid) {
          return Response.json({ error: `Webhook URL validation failed: ${urlValidation.error}` }, { status: 400 });
        }
      }

      const now = new Date().toISOString();
      let encryptedAuthData = '';
      let maskedIdentifiers = {};

      // Encrypt auth credentials if provided
      if (auth_credentials && Object.keys(auth_credentials).length > 0) {
        encryptedAuthData = await encryptJSON(auth_credentials);
        const masked = {};
        for (const key of Object.keys(auth_credentials)) {
          masked[key] = maskValue(auth_credentials[key]);
        }
        maskedIdentifiers = masked;
      }

      const updateData = {
        destination_type,
        name,
        webhook_url: webhook_url || '',
        webhook_auth_method: webhook_auth_method || 'none',
        header_names: header_names || [],
        field_mapping: field_mapping || {},
        allowed_campaign_ids: allowed_campaign_ids || [],
        default_owner_mapping: default_owner_mapping || '',
        test_mode: test_mode || false,
        updated_at: now,
        created_by_user_id: user.id,
      };

      if (encryptedAuthData) {
        updateData.encrypted_auth_data = encryptedAuthData;
        updateData.masked_auth_identifiers = maskedIdentifiers;
      }

      let destination;
      if (destination_id) {
        // Update existing
        const existing = await base44.asServiceRole.entities.HandoffDestination.get(destination_id);
        if (!existing || existing.organisation_id !== org.id) {
          return Response.json({ error: 'Destination not found' }, { status: 404 });
        }
        destination = await base44.asServiceRole.entities.HandoffDestination.update(destination_id, updateData);
      } else {
        // Create new
        destination = await base44.asServiceRole.entities.HandoffDestination.create({
          organisation_id: org.id,
          ...updateData,
          status: 'paused',
          last_test_status: 'untested',
        });
      }

      const auditAction = destination_id ? 'integration_changed' : 'integration_connected';
      await base44.asServiceRole.entities.AuditLog.create({
        organisation_id: org.id,
        actor_user_id: user.id,
        action: auditAction,
        entity_type: 'HandoffDestination',
        entity_id: destination.id,
        new_value: `${destination_type}:${name}`,
        timestamp: now,
      });

      return Response.json({ destination_id: destination.id, status: 'saved' });
    }

    if (action === 'test') {
      const { destination_id } = body;
      if (!destination_id) return Response.json({ error: 'destination_id is required' }, { status: 400 });

      const dest = await base44.asServiceRole.entities.HandoffDestination.get(destination_id);
      if (!dest || dest.organisation_id !== org.id) {
        return Response.json({ error: 'Destination not found' }, { status: 404 });
      }

      const now = new Date().toISOString();
      const testResult = { last_test_status: 'untested', last_test_at: now, last_test_error: '' };

      if (dest.destination_type === 'webhook' && dest.webhook_url) {
        const urlValidation = validateWebhookUrl(dest.webhook_url);
        if (!urlValidation.valid) {
          testResult.last_test_status = 'failed';
          testResult.last_test_error = urlValidation.error;
        } else {
          let authData = {};
          if (dest.encrypted_auth_data) {
            authData = await decryptJSON(dest.encrypted_auth_data);
          }
          const authHeaders = buildAuthHeaders(dest.webhook_auth_method, authData);
          const headers = { 'Content-Type': 'application/json', ...authHeaders };

          const testPayload = {
            test: true,
            payload_version: 1,
            cadence_opportunity_id: 'test',
            message: 'Cadence webhook test — no real data.',
            generated_at: now,
          };

          const response = await safeFetch(dest.webhook_url, {
            method: 'POST',
            headers,
            body: testPayload,
            timeoutMs: 10000,
          });

          if (response.ok) {
            testResult.last_test_status = 'success';
          } else {
            testResult.last_test_status = 'failed';
            testResult.last_test_error = `HTTP ${response.status}: ${response.safeResponseSummary?.slice(0, 200) || ''}`;
          }
        }
      } else if (dest.destination_type === 'hubspot') {
        if (!dest.encrypted_auth_data) {
          testResult.last_test_status = 'failed';
          testResult.last_test_error = 'No HubSpot token configured.';
        } else {
          const authData = await decryptJSON(dest.encrypted_auth_data);
          const token = authData.hubspot_token;
          if (!token) {
            testResult.last_test_status = 'failed';
            testResult.last_test_error = 'HubSpot token not found.';
          } else {
            const response = await safeFetch('https://api.hubapi.com/crm/v3/objects/deals?limit=1', {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              testResult.last_test_status = 'success';
            } else {
              testResult.last_test_status = 'failed';
              testResult.last_test_error = `HubSpot API returned ${response.status}`;
            }
          }
        }
      } else {
        testResult.last_test_status = 'success'; // CSV and manual always "pass"
      }

      await base44.asServiceRole.entities.HandoffDestination.update(destination_id, testResult);
      return Response.json(testResult);
    }

    if (action === 'activate' || action === 'pause' || action === 'disconnect') {
      const { destination_id } = body;
      if (!destination_id) return Response.json({ error: 'destination_id is required' }, { status: 400 });

      const dest = await base44.asServiceRole.entities.HandoffDestination.get(destination_id);
      if (!dest || dest.organisation_id !== org.id) {
        return Response.json({ error: 'Destination not found' }, { status: 404 });
      }

      const newStatus = action === 'activate' ? 'active' : action === 'pause' ? 'paused' : 'disconnected';
      await base44.asServiceRole.entities.HandoffDestination.update(destination_id, {
        status: newStatus,
        updated_at: new Date().toISOString(),
      });

      if (action === 'disconnect') {
        await base44.asServiceRole.entities.AuditLog.create({
          organisation_id: org.id,
          actor_user_id: user.id,
          action: 'integration_disconnected',
          entity_type: 'HandoffDestination',
          entity_id: destination_id,
          timestamp: new Date().toISOString(),
        });
      }

      return Response.json({ destination_id, status: newStatus });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}