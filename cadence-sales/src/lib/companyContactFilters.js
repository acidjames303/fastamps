// Rules for filtering a campaign's companies by the contact data behind them.
// A number only counts as a mobile when it matches the UK mobile numbering
// plan, so a landline can never make a company look mobile-ready.

export const EMPTY_FILTERS = {
  query: "",
  hasMobile: false,
  hasNumber: false,
  hasEmail: false,
  notCalled: false,
  industry: "",
};

const text = (value) => String(value ?? "").trim();
const hasText = (value) => !!text(value);

export function isUkMobile(value) {
  let digits = text(value).replace(/[^\d+]/g, "");
  if (!digits) return false;
  if (digits.startsWith("0044")) digits = "+" + digits.slice(4);
  if (digits.startsWith("0")) digits = "+44" + digits.slice(1);
  if (digits.startsWith("44")) digits = "+" + digits;
  return /^\+447[1-57-9]\d{8}$/.test(digits);
}

export function summariseCompanyContacts(people = []) {
  return {
    people: people.length,
    mobiles: people.filter((c) => isUkMobile(c.mobile) || isUkMobile(c.phone)).length,
    numbers: people.filter((c) => hasText(c.mobile) || hasText(c.phone) || hasText(c.direct_dial)).length,
    emails: people.filter((c) => hasText(c.email)).length,
    called: people.some((c) => Number(c.call_count || 0) > 0 || hasText(c.last_called)),
  };
}

export function filtersActive(filters) {
  return !!(
    filters.query ||
    filters.hasMobile ||
    filters.hasNumber ||
    filters.hasEmail ||
    filters.notCalled ||
    filters.industry
  );
}

export function filterCompanies(companies, statsFor, filters) {
  const needle = filters.query.trim().toLowerCase();
  return companies.filter((company) => {
    if (needle) {
      const haystack = [company.name, company.domain, company.industry, company.location]
        .map((value) => text(value).toLowerCase());
      if (!haystack.some((value) => value.includes(needle))) return false;
    }
    if (filters.industry && text(company.industry) !== filters.industry) return false;
    const stats = statsFor(company.id);
    if (filters.hasMobile && stats.mobiles === 0) return false;
    if (filters.hasNumber && stats.numbers === 0) return false;
    if (filters.hasEmail && stats.emails === 0) return false;
    if (filters.notCalled && stats.called) return false;
    return true;
  });
}