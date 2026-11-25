// Compliance utilities: phone normalisation, hashing, masking, CSV safety,
// and compliance settings resolution.

// Normalise a UK phone number to a standard format for hashing/matching
export function normalisePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+44')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('44') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  }
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  return cleaned;
}

// SHA-256 hash for phone/email matching without storing raw PII in suppression entries
export async function hashValue(value) {
  if (!value) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Mask a phone number for display in manager/admin views
export function maskPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length < 5) return '****';
  return '**** *** ' + cleaned.slice(-4);
}

// Mask an email address for display
export function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return '****';
  return (local[0] || '*') + '***@' + domain;
}

// Prevent CSV formula injection
export function sanitiseCsvValue(value) {
  if (typeof value !== 'string') return String(value ?? '');
  if (/^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

// Get or create default compliance settings for an organisation
export async function getComplianceSettings(base44, org) {
  const settings = await base44.asServiceRole.entities.ComplianceSettings.filter(
    { organisation_id: org.id }, '-updated_at', 1
  ).catch(() => []);
  if (settings?.[0]) return settings[0];

  const now = new Date().toISOString();
  return await base44.asServiceRole.entities.ComplianceSettings.create({
    organisation_id: org.id,
    operating_countries: ['United Kingdom'],
    default_lawful_basis: 'legitimate_interest',
    business_calling_only: true,
    require_source_information: true,
    require_lawful_basis: true,
    require_caller_identification: true,
    require_client_identification: true,
    recording_enabled: false,
    recording_default: false,
    recording_notice_text: 'Calls may be recorded for quality and training purposes.',
    recording_consent_mode: 'notice',
    recording_retention_days: 90,
    call_log_retention_days: 365,
    contact_retention_days: 730,
    prospect_retention_days: 365,
    unsuccessful_prospect_retention_days: 180,
    audit_retention_days: 1825,
    suppression_retention_policy: 'permanent',
    compliance_notice: 'Cadence provides controls to support your compliance process. Your organisation remains responsible for determining its lawful basis and calling policies.',
    updated_at: now,
  });
}

// Check if current time is within permitted calling hours
export function isWithinCallingHours(settings) {
  const config = settings?.calling_hours_config;
  if (!config) return { allowed: true, reason: null };

  const now = new Date();
  const hour = now.getHours();
  const dayKey = now.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase();
  const dayConfig = config[dayKey] || config.default;
  if (!dayConfig) return { allowed: true, reason: null };

  const startHour = parseInt(String(dayConfig.start || '9').split(':')[0]);
  const endHour = parseInt(String(dayConfig.end || '17').split(':')[0]);

  if (hour < startHour || hour >= endHour) {
    return { allowed: false, reason: 'Outside permitted calling hours (' + (dayConfig.start || '9am') + '–' + (dayConfig.end || '5pm') + ')' };
  }
  return { allowed: true, reason: null };
}

// Determine the user-facing compliance status label
export function complianceStatusLabel(contact) {
  if (!contact) return 'Not checked';
  if (contact.do_not_call || (contact.suppression_scope && contact.suppression_scope !== 'none')) return 'Suppressed';
  if (contact.marketing_status === 'suppressed' || contact.marketing_status === 'objected') return 'Suppressed';
  if (contact.compliance_review_status === 'review_required' || contact.compliance_review_status === 'flagged') return 'Review required';
  if (contact.screening_status === 'check_expired' || contact.screening_status === 'review_required') return 'Review required';
  if (contact.marketing_status === 'permitted') return 'Calling permitted';
  if (contact.marketing_status === 'unknown') return 'Not checked';
  return 'Not checked';
}