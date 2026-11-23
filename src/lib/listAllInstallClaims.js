import { base44 } from '@/api/base44Client';

/** Page through InstallClaim so admin review is not capped at a preview limit. */
export async function listAllInstallClaims() {
  const all = [];
  const pageSize = 500;
  const maxPages = 200;
  for (let i = 0; i < maxPages; i++) {
    const page = await base44.entities.InstallClaim.list('-created_date', pageSize, i * pageSize);
    if (!Array.isArray(page)) throw new Error('Failed to retrieve installation claims.');
    all.push(...page);
    if (page.length < pageSize) return all;
  }
  throw new Error('Installation claims exceeded the admin page limit. Contact FastAmps engineering.');
}
