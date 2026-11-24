import { createClientFromRequest } from "npm:@base44/sdk";

const PAGE = 200;

function haystack(branch: Record<string, unknown>) {
  return [
    branch.wholesaler_name,
    branch.branch_name,
    branch.town,
    branch.postcode,
    branch.county,
    ...(Array.isArray(branch.approved_aliases) ? branch.approved_aliases : []),
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  try {
    // Public pre-registration needs directory search without admin role.
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 40);

    const branches: Record<string, unknown>[] = [];
    for (let skip = 0; skip < 5000; skip += PAGE) {
      const page = await base44.asServiceRole.entities.WholesalerBranch.list("-created_date", PAGE, skip);
      if (!Array.isArray(page) || !page.length) break;
      branches.push(...page);
      if (page.length < PAGE) break;
    }

    const tokens = query.split(/\s+/).filter(Boolean);
    const filtered = (!query
      ? branches
      : branches.filter((branch) => {
        const text = haystack(branch);
        // Match when every search token appears somewhere in the branch record.
        return tokens.every((token) => text.includes(token));
      })
    )
      .slice(0, limit)
      .map((branch) => ({
        id: branch.id,
        wholesaler_name: branch.wholesaler_name,
        branch_name: branch.branch_name,
        town: branch.town || "",
        postcode: branch.postcode || "",
        county: branch.county || "",
        programme_availability: branch.programme_availability || "not_available",
        label: `${branch.wholesaler_name} – ${branch.branch_name}`,
      }));

    return Response.json({ results: filtered, total_directory: branches.length });
  } catch (error) {
    console.error("search-wholesaler-branches failed", error);
    return Response.json({ error: error?.message || "Wholesaler search failed." }, { status: 500 });
  }
});
