// Cadence runs as ONE private internal company system.
//
// There is exactly one production organisation for B2B Sales Leads, and it is
// configured here — on the server. It is never taken from a UserProfile, the
// browser, local storage, a URL parameter or a request payload, and no user can
// select, create or switch organisation.
//
// Client companies (Tunstall, Oxi Tech, ...) are records and campaigns inside
// this organisation. They are never Cadence organisations themselves.

export const CANONICAL_ORGANISATION_ID = '6a85ffb42dc95d64abe8a98d';
export const CANONICAL_ORGANISATION_NAME = 'B2B Sales Leads';

export function isCanonicalOrganisation(organisationId: any): boolean {
  return typeof organisationId === 'string' && organisationId === CANONICAL_ORGANISATION_ID;
}

// Rejects a payload that tries to name a different organisation. An absent or
// empty value is fine: the canonical organisation is used regardless.
export function assertCanonicalRequestedOrg(requestedOrganisationId: any) {
  if (requestedOrganisationId === undefined || requestedOrganisationId === null || requestedOrganisationId === '') {
    return CANONICAL_ORGANISATION_ID;
  }
  if (!isCanonicalOrganisation(requestedOrganisationId)) {
    const e: any = new Error('That organisation is not authorised. Cadence uses a single production organisation.');
    e.status = 403;
    throw e;
  }
  return CANONICAL_ORGANISATION_ID;
}