import { base44 } from '@/api/base44Client';

// Read the entire register in pages. Never silently stop at a fixed preview limit:
// both operational statistics and admin decisions depend on complete records.
export async function listAllChargers() {
  const all = [];
  const pageSize = 2000;
  const maxPages = 100; // fail closed if the register exceeds 200,000 records.
  for (let i = 0; i < maxPages; i++) {
    const page = await base44.entities.Charger.list('-created_date', pageSize, i * pageSize);
    if (!Array.isArray(page)) throw new Error('Failed to retrieve the complete FastAmps charger register.');
    all.push(...page);
    if (page.length < pageSize) return all;
  }
  throw new Error('The register exceeded 200,000 records. Reporting requires server-side pagination before continuing.');
}
