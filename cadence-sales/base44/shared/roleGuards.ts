// Reusable role-guard helpers for backend functions.
// All role checks use the trusted UserProfile.app_role resolved server-side
// via resolveTenant — never from client-supplied values.
import { resolveTenant } from './tenantAuth.ts';
export { resolveTenant };

export const ROLE_LEVELS: Record<string, number> = {
  platform_owner: 100,
  organisation_admin: 50,
  sales_manager: 30,
  bdm: 10,
  reporting_user: 10,
};

export function isPlatformOwner(profile: any): boolean {
  return profile?.app_role === 'platform_owner';
}

export function isOrgAdmin(profile: any): boolean {
  return ['platform_owner', 'organisation_admin'].includes(profile?.app_role);
}

export function isManager(profile: any): boolean {
  return ['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile?.app_role);
}

export function isCaller(profile: any): boolean {
  return ['bdm', 'reporting_user'].includes(profile?.app_role);
}

export function requireRole(profile: any, allowedRoles: string[]): void {
  if (!allowedRoles.includes(profile?.app_role)) {
    const e = new Error('Access denied: insufficient permissions.');
    (e as any).status = 403;
    throw e;
  }
}

// Resolve tenant and require platform_owner.
export async function resolvePlatformOwner(req: Request) {
  const ctx = await resolveTenant(req);
  requireRole(ctx.profile, ['platform_owner']);
  return ctx;
}

// Resolve tenant and require organisation_admin or platform_owner.
export async function resolveOrgAdmin(req: Request) {
  const ctx = await resolveTenant(req);
  requireRole(ctx.profile, ['platform_owner', 'organisation_admin']);
  return ctx;
}

// Resolve tenant and require sales_manager, organisation_admin, or platform_owner.
export async function resolveManager(req: Request) {
  const ctx = await resolveTenant(req);
  requireRole(ctx.profile, ['platform_owner', 'organisation_admin', 'sales_manager']);
  return ctx;
}

// Simple deterministic hash for percentage-based rollouts.
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}