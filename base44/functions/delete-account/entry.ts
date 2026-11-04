import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = user.email;
    if (!email) return Response.json({ error: 'No account email on this session' }, { status: 400 });

    // Only the signed-in user's own records are removed. Installation claims and
    // voucher requests are retained for warranty and financial audit purposes.
    const installers = await base44.asServiceRole.entities.Installer.filter({ user_email: email });
    for (const installer of installers || []) {
      await base44.asServiceRole.entities.Installer.delete(installer.id);
    }
    await base44.asServiceRole.entities.CourseProgress.deleteMany({ installer_email: email });
    await base44.asServiceRole.entities.Earning.deleteMany({ installer_email: email });

    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}