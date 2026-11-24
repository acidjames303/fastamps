// Pre-action cost guard for expensive operations. Prevents race conditions
// by reserving usage before executing the action, then committing or releasing.
//
// Flow:
//   1. resolveTenant (caller does this)
//   2. guardAction — checks entitlements + reserves usage
//   3. execute the expensive action
//   4. commitReservation — records usage and releases the reservation as committed
//   5. On failure: releaseReservation — releases without recording usage

import { resolveSubscription, checkEntitlement, getUsageLimit, hasReachedHardLimit } from './entitlements.ts';
import { recordUsageEvent } from './usageLedger.ts';

const RESERVATION_TTL_MINUTES = 10;

function now() { return new Date().toISOString(); }
function expiresAt() {
  return new Date(Date.now() + RESERVATION_TTL_MINUTES * 60000).toISOString();
}

// Check + reserve usage before an expensive action.
// Returns { reservation } on success, throws on denial.
export async function guardAction(base44, user, profile, org, feature, qty = 1, idempotencyKey = null) {
  const subscription = await resolveSubscription(base44, org);

  const entitlement = await checkEntitlement(base44, org, subscription, feature, qty);
  if (!entitlement.allowed) {
    const e = new Error(entitlement.reason);
    e.status = 403;
    throw e;
  }

  // Create a reservation to prevent race conditions
  const reservation = await base44.asServiceRole.entities.UsageReservation.create({
    organisation_id: org.id,
    user_id: user.id,
    feature,
    quantity: qty,
    status: 'reserved',
    idempotency_key: idempotencyKey || `${org.id}:${feature}:${Date.now()}`,
    reserved_at: now(),
    expires_at: expiresAt(),
  });

  return { subscription, reservation };
}

// Commit a reservation — the action succeeded, record the usage event.
export async function commitReservation(base44, reservationId, usageParams) {
  const reservation = await base44.asServiceRole.entities.UsageReservation.get(reservationId);
  if (!reservation) return;
  if (reservation.status !== 'reserved') return;

  // Record the actual usage
  if (usageParams) {
    await recordUsageEvent(base44, {
      ...usageParams,
      organisation_id: reservation.organisation_id,
      user_id: reservation.user_id,
      idempotency_key: reservation.idempotency_key,
    });
  }

  await base44.asServiceRole.entities.UsageReservation.update(reservationId, {
    status: 'committed',
    committed_at: now(),
  });
}

// Release a reservation — the action failed, no usage to charge.
export async function releaseReservation(base44, reservationId, reason = '') {
  const reservation = await base44.asServiceRole.entities.UsageReservation.get(reservationId);
  if (!reservation) return;
  if (reservation.status !== 'reserved') return;

  await base44.asServiceRole.entities.UsageReservation.update(reservationId, {
    status: 'released',
    released_at: now(),
  });
}

// Clean up expired reservations — call periodically or before guardAction.
export async function cleanupExpiredReservations(base44) {
  const nowStr = now();
  const reservations = await base44.asServiceRole.entities.UsageReservation.filter(
    { status: 'reserved' },
    '-created_date', 100
  );
  for (const r of reservations) {
    if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) {
      await base44.asServiceRole.entities.UsageReservation.update(r.id, {
        status: 'expired',
      });
    }
  }
}