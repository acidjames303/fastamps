/**
 * Shared primary navigation for Cadence.
 * Phase 1 UX: everyday work first; admin/platform stays secondary.
 *
 * Target IA: Today · Campaigns · Prospecting · Calling · Outreach · Inbox · Team
 */
import {
  CalendarCheck,
  Phone,
  ClipboardList,
  Mail,
  Inbox,
  UserCog,
  Users,
  BarChart3,
  TrendingUp,
  Settings as SettingsIcon,
  ListChecks,
  Search,
  Rocket,
  MessageSquare,
  Flag,
  AlertTriangle,
  ClipboardCheck,
  Activity,
  Gauge,
  Server,
  Building2,
} from "lucide-react";

export const ROLE_LEVELS = {
  platform_owner: 100,
  organisation_admin: 50,
  sales_manager: 30,
  bdm: 10,
  internal_bd: 10,
  reporting_user: 10,
};

/** Primary chrome — short, scannable, role-filtered */
export const MAIN_NAV = [
  { to: "/app", label: "Today", icon: CalendarCheck, minLevel: 10 },
  { to: "/campaigns", label: "Campaigns", icon: ClipboardList, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/campaigns?tab=prospect", label: "Prospecting", icon: Search, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/dialer", label: "Calling", icon: Phone, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/outreach", label: "Outreach", icon: Mail, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/manager-inbox", label: "Inbox", icon: Inbox, minLevel: 50 },
  { to: "/team", label: "Team", icon: UserCog, minLevel: 30 },
];

/** Secondary — More menu / overflow only (admin + less-daily tools) */
export const SECONDARY_NAV = [
  { to: "/contacts", label: "Contacts", icon: Users, minLevel: 10 },
  { to: "/results", label: "Results", icon: BarChart3, minLevel: 10 },
  { to: "/performance-insights", label: "Insights", icon: TrendingUp, minLevel: 10 },
  { to: "/settings", label: "Settings", icon: SettingsIcon, minLevel: 50 },
  { to: "/onboarding", label: "Get Started", icon: ListChecks, minLevel: 10 },
];

export const PLATFORM_NAV = [
  { to: "/pilot-console", label: "Pilot Console", icon: Rocket },
  { to: "/feedback-review", label: "Feedback", icon: MessageSquare },
  { to: "/feature-flags", label: "Feature Flags", icon: Flag },
  { to: "/incidents", label: "Incidents", icon: AlertTriangle },
  { to: "/pilot-readiness", label: "Pilot Readiness", icon: ClipboardCheck },
  { to: "/health", label: "Health", icon: Activity },
  { to: "/capacity", label: "Capacity", icon: Gauge },
  { to: "/saas-ops", label: "SaaS Ops", icon: Server },
  { to: "/org-admin", label: "Org Admin", icon: Building2 },
];

/** Mobile bottom tabs — 4 most-used + More drawer */
export const MOBILE_TABS = [
  { to: "/app", label: "Today", icon: CalendarCheck, minLevel: 10 },
  { to: "/campaigns", label: "Campaigns", icon: ClipboardList, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/dialer", label: "Calling", icon: Phone, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/outreach", label: "Outreach", icon: Mail, minLevel: 10, excludeRoles: ["reporting_user"] },
];

export function navVisible(item, user, userLevel) {
  if (item.to.startsWith("/outreach") && user?.app_role === "internal_bd") return true;
  if (userLevel < (item.minLevel ?? 0)) return false;
  if ((item.excludeRoles || []).includes(user?.app_role)) return false;
  return true;
}

export function isNavActive(pathname, search, item) {
  const path = item.to.split("?")[0];
  const tab = new URLSearchParams(item.to.split("?")[1] || "").get("tab");
  const currentTab = new URLSearchParams(search || "").get("tab");

  if (path === "/app") return pathname === "/app";

  if (tab === "prospect") {
    return pathname.startsWith("/campaigns") && currentTab === "prospect";
  }

  if (path === "/campaigns") {
    if (currentTab === "prospect") return false;
    return (
      pathname.startsWith("/campaigns") ||
      pathname.startsWith("/target-lists") ||
      pathname.startsWith("/review-queue")
    );
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}
