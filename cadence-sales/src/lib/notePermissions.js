// Who may correct the notes on a logged call.
// Admins and managers can fix any note in their organisation; everyone else can
// only correct notes on calls they logged themselves.
const NOTE_EDITOR_ROLES = ["platform_owner", "organisation_admin", "sales_manager"];

export function canEditCallNotes({ appRole, userId, log } = {}) {
  if (!userId || !log) return false;
  if (NOTE_EDITOR_ROLES.includes(appRole)) return true;
  return log.created_by_user_id === userId || log.user_id === userId;
}