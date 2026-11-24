// Canonical pilot readiness model — Sprint 14D.
// One shared definition used by PilotProgramme, Organisation,
// PilotReadinessEvidence, Pilot Console, activation gate, and onboarding.
// Replaces the Sprint 14A/14B fragmented check model.

export type EvidenceMethod =
  | 'automated'
  | 'database_verification'
  | 'user_browser_confirmation'
  | 'platform_owner_confirmation';

export interface CanonicalCheck {
  key: string;
  label: string;
  category: 'critical' | 'compliance' | 'operational';
  description: string;
  acceptable_evidence: EvidenceMethod[];
  required_for_internal: boolean;
  required_for_external: boolean;
}

// The 13 canonical readiness checks.
export const CANONICAL_CHECKS: CanonicalCheck[] = [
  { key: 'production_build', label: 'Production build passes', category: 'critical', description: 'App builds without errors for production deployment.', acceptable_evidence: ['automated'], required_for_internal: true, required_for_external: true },
  { key: 'credentials_secure', label: 'Credentials encrypted (no plaintext)', category: 'critical', description: 'All provider credentials stored encrypted; no plaintext in Organisation.settings.', acceptable_evidence: ['automated'], required_for_internal: true, required_for_external: true },
  { key: 'credential_rotation_confirmed', label: 'Credential rotation confirmed', category: 'critical', description: 'Twilio API key rotation completed and confirmed by platform owner.', acceptable_evidence: ['platform_owner_confirmation'], required_for_internal: true, required_for_external: true },
  { key: 'provider_test_successful', label: 'Provider connection test passed', category: 'critical', description: 'Twilio/Yay credentials verified against the live provider API.', acceptable_evidence: ['automated'], required_for_internal: true, required_for_external: true },
  { key: 'test_call', label: 'Test call completed', category: 'critical', description: 'At least one test CallLog exists with a real outcome.', acceptable_evidence: ['database_verification'], required_for_internal: true, required_for_external: true },
  { key: 'callback_creation', label: 'Callback task created', category: 'critical', description: 'A connected callback outcome created exactly one follow-up Task.', acceptable_evidence: ['database_verification'], required_for_internal: true, required_for_external: true },
  { key: 'callback_survived_relogin', label: 'Callback survived re-login', category: 'critical', description: 'Callback task remains visible after logout and re-login.', acceptable_evidence: ['user_browser_confirmation'], required_for_internal: true, required_for_external: true },
  { key: 'notes_history_verified', label: 'Notes and history verified', category: 'critical', description: 'Call notes and history display correctly in the dialer.', acceptable_evidence: ['user_browser_confirmation'], required_for_internal: true, required_for_external: true },
  { key: 'results_accuracy', label: 'Results metrics accurate', category: 'critical', description: 'Results page totals match source CallLog data for each tenant.', acceptable_evidence: ['automated', 'user_browser_confirmation'], required_for_internal: true, required_for_external: true },
  { key: 'tenant_isolation', label: 'Tenant isolation confirmed', category: 'critical', description: 'Organisation A cannot see Organisation B data in a live browser session.', acceptable_evidence: ['user_browser_confirmation'], required_for_internal: false, required_for_external: true },
  { key: 'suppression_enforcement', label: 'Suppression enforcement tested', category: 'compliance', description: 'Suppressed contacts are blocked before provider call initiation.', acceptable_evidence: ['automated'], required_for_internal: true, required_for_external: true },
  { key: 'subscription_active', label: 'Subscription or trial active', category: 'operational', description: 'Organisation has an active or trialing subscription.', acceptable_evidence: ['automated'], required_for_internal: true, required_for_external: true },
  { key: 'checkpoint_created', label: 'Sandbox checkpoint recorded', category: 'operational', description: 'Base44 sandbox checkpoint exists for rollback.', acceptable_evidence: ['platform_owner_confirmation'], required_for_internal: true, required_for_external: true },
];

export const CHECK_KEYS = CANONICAL_CHECKS.map(c => c.key);

// Migration map: legacy evidence check_keys → canonical check_keys.
// Historical evidence with old keys is preserved in the database; this map
// links it to the canonical check when building the evidence map.
export const KEY_MIGRATION: Record<string, string> = {
  live_tenant_test: 'tenant_isolation',
  results_certification: 'results_accuracy',
  callback_task_exists: 'callback_creation',
  checkpoint_real: 'checkpoint_created',
  test_call_evidence: 'test_call',
  production_build_evidence: 'production_build',
  suppression_test: 'suppression_enforcement',
  initial_task_exists: 'callback_creation',
};

// Resolve a legacy check_key to its canonical key.
export function migrateKey(key: string): string {
  return KEY_MIGRATION[key] || key;
}

// Check whether an evidence method is acceptable for a given canonical check.
export function isAcceptableEvidence(checkKey: string, method: string): boolean {
  const check = CANONICAL_CHECKS.find(c => c.key === checkKey);
  if (!check) return false;
  return check.acceptable_evidence.includes(method as EvidenceMethod);
}

// Build a map of the newest valid, non-expired evidence per canonical check_key.
// Legacy keys are migrated to canonical keys. Historical evidence is preserved
// but only the newest non-expired record determines the current status.
export function buildEvidenceMap(evidenceRecords: any[]): Record<string, any> {
  const now = Date.now();
  const map: Record<string, any> = {};
  for (const e of evidenceRecords || []) {
    const expired = e.expires_at && new Date(e.expires_at).getTime() < now;
    if (expired) continue;
    const canonicalKey = migrateKey(e.check_key);
    if (!map[canonicalKey] || new Date(e.checked_at) > new Date(map[canonicalKey].checked_at)) {
      map[canonicalKey] = e;
    }
  }
  return map;
}

// Determine whether a canonical check passes based on evidence and acceptable methods.
export function checkPasses(checkKey: string, evidenceMap: Record<string, any>): {
  passed: boolean;
  status: string;
  evidence_method: string;
  evidence: any;
  reason: string;
} {
  const check = CANONICAL_CHECKS.find(c => c.key === checkKey);
  if (!check) return { passed: false, status: 'not_tested', evidence_method: '', evidence: null, reason: 'Unknown check.' };

  const evidence = evidenceMap[checkKey];
  if (!evidence) return { passed: false, status: 'not_tested', evidence_method: '', evidence: null, reason: 'No valid evidence recorded.' };
  if (evidence.status !== 'passed') return { passed: false, status: evidence.status, evidence_method: evidence.evidence_method || (evidence.automated ? 'automated' : 'database_verification'), evidence, reason: evidence.failure_reason || `Evidence status: ${evidence.status}.` };

  const method = evidence.evidence_method || (evidence.automated ? 'automated' : 'database_verification');
  if (!check.acceptable_evidence.includes(method as EvidenceMethod)) {
    return { passed: false, status: 'blocked', evidence_method: method, evidence, reason: `Evidence method "${method}" is not acceptable for ${checkKey}. Required: ${check.acceptable_evidence.join(' or ')}.` };
  }

  return { passed: true, status: 'passed', evidence_method: method, evidence, reason: '' };
}

// Evaluate all canonical checks for the activation gate.
export function evaluateActivationGate(evidenceMap: Record<string, any>, level: 'internal' | 'external'): {
  checks: Array<{ key: string; label: string; passed: boolean; status: string; evidence_method: string; reason: string; required: boolean }>;
  blockers: string[];
  all_passed: boolean;
} {
  const checks = CANONICAL_CHECKS.map(check => {
    const result = checkPasses(check.key, evidenceMap);
    const required = level === 'internal' ? check.required_for_internal : check.required_for_external;
    return {
      key: check.key,
      label: check.label,
      passed: result.passed,
      status: result.status,
      evidence_method: result.evidence_method,
      reason: result.reason,
      required,
    };
  });

  const blockers = checks.filter(c => c.required && !c.passed).map(c => `${c.label} — ${c.reason}`);
  const all_passed = blockers.length === 0;

  return { checks, blockers, all_passed };
}

// Legacy compat — still used by getPilotReadiness and PilotReadiness page.
export const READINESS_CHECKS = CANONICAL_CHECKS;
export const CRITICAL_CHECKS = CANONICAL_CHECKS.filter(c => c.category === 'critical').map(c => c.key);

export function isPilotReady(checks: Record<string, { status: string }>): boolean {
  return CRITICAL_CHECKS.every(k => checks[k]?.status === 'pass');
}