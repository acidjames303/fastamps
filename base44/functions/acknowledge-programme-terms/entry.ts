import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const db = createClientFromRequest(req);
  try {
    const user = await db.auth.me();
    if (!user?.email) return Response.json({ error: "Sign in first." }, { status: 401 });
    const body = await req.json();
    if (body.accepted !== true || body.version !== "2026-10-v1") {
      return Response.json({ error: "You must read and accept the current programme terms." }, { status: 400 });
    }
    const profiles = await db.asServiceRole.entities.Installer.filter({ user_email: user.email });
    if (profiles.length !== 1) return Response.json({ error: "Installer profile not found." }, { status: 404 });
    const date = new Date().toISOString();
    await db.asServiceRole.entities.Installer.update(profiles[0].id, {
      programme_terms_version: body.version,
      programme_terms_accepted_at: date,
      referral_terms_version: body.version,
      referral_terms_accepted_at: date,
    });
    return Response.json({ success: true, version: body.version, accepted_at: date });
  } catch {
    return Response.json({ error: "Could not save programme terms acknowledgement." }, { status: 500 });
  }
});
