// Shared display-name splitter for CSV exports (mirrors base44/shared/lusha.splitPersonName).
const NAME_TITLES = /^(dr|mr|mrs|ms|miss|prof|sir|dame|lord|lady)\.?\s+/i;
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'mbe', 'obe', 'cbe', 'phd', 'mba']);

export function splitPersonName(full) {
  let value = String(full || '')
    .replace(/[\u2018\u2019\u02BC']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  value = value.replace(NAME_TITLES, '');
  const parts = value.split(' ').filter(Boolean);
  while (
    parts.length > 2 &&
    NAME_SUFFIXES.has(parts[parts.length - 1].replace(/\./g, '').toLowerCase())
  ) {
    parts.pop();
  }
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}
