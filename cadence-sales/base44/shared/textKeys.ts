// Shared string keys used to match companies and prospects across lists,
// campaigns and organisations. One definition so a match decision can never
// depend on which function happened to run it.

export const clean = (value: any) => String(value ?? '').trim();

export const digitsWithPlus = (value: any) => clean(value).replace(/[^\d+]/g, '');
export const digitsOnly = (value: any) => clean(value).replace(/[^\d]/g, '');

export const domainKey = (value: any) => clean(value)
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .split('/')[0];

// Simple case/space normalisation — used where the stored name is expected to
// match as typed.
export const nameKeySimple = (value: any) => clean(value).toLowerCase().replace(/\s+/g, ' ');

// Legal-name normalisation — strips company-form suffixes and punctuation so
// "MODA LIVING LIMITED", "Moda Living Ltd" and "Moda Living" collapse together.
export const nameKeyLegal = (value: any) => clean(value)
  .toLowerCase()
  .replace(/\b(ltd|limited|plc|llp|the|group|holdings|uk)\b/g, ' ')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const escapeRegex = (value: any) => clean(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}