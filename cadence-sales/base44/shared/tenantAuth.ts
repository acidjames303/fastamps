import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { loadActiveMembership, capabilitiesForMembership, auditSecurity } from './authorization.ts';
import { CANONICAL_ORGANISATION_ID } from './tenantConfig.ts';

// Shared tenant resolution for backend functions.
//
// Cadence is a single-company internal system. The production organisation is
// fixed server-side (tenantConfig.ts) — it is NOT read from UserProfile, the
// browser, local storage, URL parameters or the request payload, and a request
// naming any other organisation is refused.
//
// Internal User Access (OrganisationMembership) answers only: is this user
// active, what internal role do they hold, what capabilities may they use.
//
// Returns { base44, user, profile, org, membership, capabilities }.
export async function resolveTenant(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    const e = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }

  let membership;
  try {
    membership = await loadActiveMembership(base44, user.id);
  } catch (err) {
    if (!err?.securityDenial) {
      // Throttled or temporarily unavailable. That is not an access decision, so
      // it must not read as lost access or be logged as a security event.
      const busy = new Error('Cadence is busy right now — please try again in a moment.');
      busy.status = 429;
      throw busy;
    }
    await auditSecurity(base44, {
      actorUserId: user.id,
      action: 'security_access_denied',
      entityType: 'OrganisationMembership',
      newValue: err.message,
    });
    throw err;
  }

  const service = base44.asServiceRole.entities;
  const org = await service.Organisation.get(CANONICAL_ORGANISATION_ID);
  if (!org) {
    const e = new Error('Production organisation not found.');
    e.status = 403;
    throw e;
  }
  if (org.status !== 'active') {
    const e = new Error('Production organisation is ' + org.status + '.');
    e.status = 403;
    throw e;
  }

  const displayRows = await service.UserProfile.filter({ user_id: user.id });
  const display = (displayRows && displayRows[0]) || {};
  const capabilities = capabilitiesForMembership(membership);

  const profile = {
    ...display,
    app_role: membership.role,
    organisation_id: CANONICAL_ORGANISATION_ID,
    status: 'active',
    capabilities,
    membership_id: membership.id,
    membership_version: membership.version || 1,
  };

  return { base44, user, profile, org, membership, capabilities };
}