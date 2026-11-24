// Canonical backend authorisation.
//
// The ONLY source of role, organisation and capabilities is OrganisationMembership,
// written solely by server-side administration. UserProfile, the client, request
// bodies, URL parameters, local storage and background-job payloads are never proof.
//
// Backend functions must call requireMembership / requireCapability and must never
// trust an app_role or organisation_id supplied by the caller.

import { ROLE_CAPABILITIES } from './capabilities.ts';
import { isCanonicalOrganisation } from './tenantConfig.ts';

export const SELF_EDITABLE_PROFILE_FIELDS = [
  'full_name',
  'job_title',
  'telephony_identity',
  'daily_call_target',
  'notification_preferences',
  'briefing_customization',
];

export const PROTECTED_PROFILE_FIELDS = [
  'app_role',
  'organisation_id',
  'user_id',
  'status',
  'managed_by_user_id',
  'membership_id',
  'capabilities',
];

export function forbidden(message: string, status = 403) {
  const e: any = new Error(message);
  e.status = status;
  // Marks a deliberate access decision. A throttled or transient read failure is
  // never one of these, and must not be reported or audited as lost access.
  e.securityDenial = true;
  return e;
}

// A page mount fans out into several backend calls at once and each needs the
// caller's membership. Keeping the freshly-read rows for a few seconds absorbs
// that burst without weakening the model: every chargeable path re-reads with
// { fresh: true }, so a revocation still lands before any credit is spent.
const MEMBERSHIP_TTL_MS = 5000;
const membershipCache = new Map<string, { at: number; rows: any[] }>();

export function membershipIsActive(m: any): boolean {
  if (!m || m.status !== 'active') return false;
  if (m.expires_at && new Date(m.expires_at).getTime() <= Date.now()) return false;
  return true;
}

export function capabilitiesForMembership(m: any): string[] {
  if (!m) return [];
  const explicit = Array.isArray(m.capabilities) ? m.capabilities.filter(Boolean) : [];
  if (explicit.length) return explicit;
  return ROLE_CAPABILITIES[m.role] || [];
}

export async function auditSecurity(base44: any, entry: {
  organisationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  previousValue?: string;
  newValue?: string;
}) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: entry.organisationId || 'unassigned',
      actor_user_id: entry.actorUserId || '',
      action: entry.action,
      entity_type: entry.entityType || 'Security',
      entity_id: entry.entityId || '',
      previous_value: entry.previousValue || '',
      new_value: entry.newValue || '',
      timestamp: new Date().toISOString(),
    });
  } catch (_) {
    // Auditing must never grant or deny access.
  }
}

// Loads the caller's membership from the server-controlled store. Rejects missing,
// disabled and expired membership. Rejects ambiguous multi-organisation access so a
// tenant can never be guessed.
export async function loadActiveMembership(base44: any, userId: string, opts: { fresh?: boolean } = {}) {
  const cached = membershipCache.get(userId);
  let all: any[];
  if (!opts.fresh && cached && Date.now() - cached.at < MEMBERSHIP_TTL_MS) {
    all = cached.rows;
  } else {
    const rows = await base44.asServiceRole.entities.OrganisationMembership.filter({ user_id: userId });
    all = rows || [];
    membershipCache.set(userId, { at: Date.now(), rows: all });
  }
  // Cadence has exactly one production organisation. An access record granting
  // anything outside it is a legacy beta/isolation artefact and grants nothing.
  const active = all.filter((m: any) => isCanonicalOrganisation(m.organisation_id) && membershipIsActive(m));
  if (all.length && !active.length) {
    await auditSecurity(base44, {
      actorUserId: userId,
      action: 'security_access_denied',
      entityType: 'OrganisationMembership',
      newValue: 'membership_outside_production_organisation',
    });
    throw forbidden('Your access record belongs to a retired workspace. Ask a B2B Sales Leads administrator for access.');
  }
  if (!active.length) {
    await auditSecurity(base44, {
      actorUserId: userId,
      action: 'security_access_denied',
      entityType: 'OrganisationMembership',
      newValue: 'no_active_membership',
    });
    throw forbidden('No active organisation membership. Access is blocked until an administrator assigns one.');
  }
  if (active.length > 1) {
    await auditSecurity(base44, {
      actorUserId: userId,
      organisationId: active[0].organisation_id,
      action: 'security_access_denied',
      entityType: 'OrganisationMembership',
      newValue: `ambiguous_memberships:${active.length}`,
    });
    throw forbidden('This account has more than one active organisation membership. An administrator must resolve it before access is granted.');
  }
  return active[0];
}

export async function requireMembership(base44: any, user: any, opts: { fresh?: boolean } = {}) {
  if (!user || !user.id) throw forbidden('Unauthorized', 401);
  const membership = await loadActiveMembership(base44, user.id, opts);
  return { membership, capabilities: capabilitiesForMembership(membership) };
}

// The single capability gate every sensitive operation uses.
export async function requireCapability(
  base44: any,
  user: any,
  capability: string,
  requestedOrganisationId?: string | null,
  opts: { fresh?: boolean } = {},
) {
  const { membership, capabilities } = await requireMembership(base44, user, opts);

  if (requestedOrganisationId && !isCanonicalOrganisation(requestedOrganisationId)) {
    await auditSecurity(base44, {
      actorUserId: user.id,
      organisationId: membership.organisation_id,
      action: 'security_access_denied',
      entityType: 'OrganisationMembership',
      entityId: membership.id,
      newValue: `cross_tenant_request:${requestedOrganisationId}`,
    });
    throw forbidden('That organisation is not authorised for this account.');
  }

  if (!capabilities.includes(capability)) {
    await auditSecurity(base44, {
      actorUserId: user.id,
      organisationId: membership.organisation_id,
      action: 'security_access_denied',
      entityType: 'OrganisationMembership',
      entityId: membership.id,
      newValue: `capability_denied:${capability}`,
    });
    throw forbidden('Your role does not permit this action.');
  }

  return {
    membership,
    capabilities,
    organisationId: membership.organisation_id,
    role: membership.role,
  };
}

// Rejects any attempt to set a security field through a self-service profile update.
export function pickSelfEditable(payload: any) {
  const body = payload || {};
  const attempted = Object.keys(body).filter((k) => PROTECTED_PROFILE_FIELDS.includes(k));
  if (attempted.length) {
    throw forbidden(`These fields cannot be changed from the app: ${attempted.join(', ')}.`);
  }
  const out: any = {};
  for (const k of SELF_EDITABLE_PROFILE_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (!Object.keys(out).length) throw forbidden('No editable profile fields were supplied.', 400);
  return out;
}