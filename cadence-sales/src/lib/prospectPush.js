import { base44 } from "@/api/base44Client";

// Push prospects into a target list in chunks, reporting progress as each chunk
// lands. All record work happens server-side in bulk, so a whole sheet moves in
// a handful of requests instead of a dozen per company.
const CHUNK_SIZE = 25;

export async function pushProspectsToTargetList({ prospectIds, targetListId, onProgress }) {
  const ids = [...new Set((prospectIds || []).filter(Boolean))];
  const result = { pushed: 0, failed: 0, companies_created: 0, contacts_created: 0, members_added: 0 };
  if (!ids.length || !targetListId) return result;

  onProgress?.({ done: 0, total: ids.length });

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    try {
      const response = await base44.functions.invoke("pushProspectsToTargetList", {
        target_list_id: targetListId,
        prospect_ids: chunk,
      });
      const data = response.data || response;
      if (!data || data.error) throw new Error(data?.error || "Push failed");
      result.pushed += data.pushed || 0;
      result.companies_created += data.companies_created || 0;
      result.contacts_created += data.contacts_created || 0;
      result.members_added += data.members_added || 0;
    } catch {
      result.failed += chunk.length;
    }
    onProgress?.({ done: Math.min(i + CHUNK_SIZE, ids.length), total: ids.length });
  }

  return result;
}