import { createClientFromRequest } from "npm:@base44/sdk";

/**
 * Progress-only Academy completion.
 * Does not create Earning rows or monetary rewards until incentives are redefined.
 */
export default async function (req) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const db = createClientFromRequest(req);
  try {
    const user = await db.auth.me();
    if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });

    const body = await req.json();
    const courseId = String(body.course_id || "").trim();
    if (!courseId) return Response.json({ error: "course_id is required." }, { status: 400 });

    const installer = (await db.asServiceRole.entities.Installer.filter({ user_email: user.email }))[0];
    if (!installer) return Response.json({ error: "Installer profile not found." }, { status: 404 });

    const course = await db.asServiceRole.entities.Course.get(courseId);
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });

    const existing = await db.asServiceRole.entities.CourseProgress.filter({
      installer_email: user.email,
      course_id: courseId,
    });
    let progress = existing[0];
    if (progress) {
      if (!progress.completed) {
        await db.asServiceRole.entities.CourseProgress.update(progress.id, {
          completed: true,
          installer_mobile: installer.mobile,
          installer_email: user.email,
        });
        progress = { ...progress, completed: true };
      }
    } else {
      // Fallback for legacy rows keyed only by mobile
      const byMobile = await db.asServiceRole.entities.CourseProgress.filter({
        installer_mobile: installer.mobile,
        course_id: courseId,
      });
      if (byMobile[0]) {
        progress = byMobile[0];
        await db.asServiceRole.entities.CourseProgress.update(progress.id, {
          completed: true,
          installer_email: user.email,
        });
      } else {
        progress = await db.asServiceRole.entities.CourseProgress.create({
          installer_mobile: installer.mobile,
          installer_email: user.email,
          course_id: courseId,
          completed: true,
        });
      }
    }

    const courses = await db.asServiceRole.entities.Course.list("order", 200);
    const allProgress = await db.asServiceRole.entities.CourseProgress.filter({
      installer_email: user.email,
    });
    const legacyProgress = await db.asServiceRole.entities.CourseProgress.filter({
      installer_mobile: installer.mobile,
    });
    const completedIds = new Set(
      [...allProgress, ...legacyProgress].filter((p) => p.completed).map((p) => p.course_id),
    );
    const trainingProgress = courses.length
      ? Math.round((completedIds.size / courses.length) * 100)
      : 0;

    // training_progress is admin-field-locked; service role can update.
    await db.asServiceRole.entities.Installer.update(installer.id, {
      training_progress: trainingProgress,
    });

    return Response.json({
      success: true,
      progress,
      training_progress: trainingProgress,
      monetary_reward_created: false,
      message: "Course marked complete. Training rewards are progress-only until FastAmps confirms the incentive structure.",
    });
  } catch (error) {
    console.error("complete-course failed", error);
    return Response.json({ error: error?.message || "Could not complete course." }, { status: 500 });
  }
}
