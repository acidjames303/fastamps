// Product language: vision "BDM" = sales_manager; vision "SDR/caller" = code role bdm.
export const ROLE_LABELS = {
  platform_owner: "Platform owner",
  organisation_admin: "Campaign administrator",
  internal_bd: "Internal business development",
  sales_manager: "BDM / Manager",
  bdm: "Caller / SDR",
  reporting_user: "Reporting",
  invited: "Invited",
};

export const isManagerRole = (role) =>
  ["platform_owner", "organisation_admin", "sales_manager"].includes(role);

export const isCallerRole = (role) => role === "bdm" || role === "reporting_user";

export const LIVE_STATUS_LABEL = {
  in_call: "On a call",
  logging: "Logging notes",
  idle: "In Cadence",
  offline: "No recent activity",
};

/** Short definitions so BDMs never confuse heartbeat with call performance. */
export const LIVE_STATUS_HINT = {
  in_call: "Currently connected on the dialer",
  logging: "Just finished a call and saving the outcome",
  idle: "Cadence is open — not on a call right now",
  offline: "No heartbeat in the last 2 minutes (not the same as logged-out time)",
};

export const LIVE_STATUS_TONE = {
  in_call: "bg-emerald-50 text-emerald-700 border-emerald-200",
  logging: "bg-amber-50 text-amber-700 border-amber-200",
  idle: "bg-sky-50 text-sky-700 border-sky-200",
  offline: "bg-slate-50 text-slate-500 border-slate-200",
};