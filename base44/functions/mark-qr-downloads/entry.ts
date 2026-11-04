import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (user?.role !== "admin") {
      return Response.json({ error: "FastAmps admin access is required." }, { status: 403 });
    }

    const body = await req.json();
    const chargerIds = Array.from(new Set(
      (Array.isArray(body.charger_ids) ? body.charger_ids : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ));

    if (!chargerIds.length || chargerIds.length > 500) {
      return Response.json({ error: "Provide between 1 and 500 charger IDs." }, { status: 400 });
    }

    const downloadedAt = new Date().toISOString();
    let updated = 0;

    for (let offset = 0; offset < chargerIds.length; offset += 20) {
      const group = chargerIds.slice(offset, offset + 20);
      const results = await Promise.all(group.map(async (chargerId) => {
        const charger = await base44.asServiceRole.entities.Charger.get(chargerId);
        if (!charger) return false;
        await base44.asServiceRole.entities.Charger.update(chargerId, {
          qr_download_count: Number(charger.qr_download_count || 0) + 1,
          qr_last_downloaded_at: downloadedAt,
        });
        return true;
      }));
      updated += results.filter(Boolean).length;
    }

    return Response.json({ updated, downloaded_at: downloadedAt });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The download could not be recorded." },
      { status: 500 },
    );
  }
});
