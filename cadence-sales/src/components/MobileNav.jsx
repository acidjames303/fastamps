import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarCheck, Users, Phone, BarChart3, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  ListChecks,
  Settings as SettingsIcon, UserCog, LifeBuoy, LogOut, Rocket,
  MessageSquare, Flag, AlertTriangle, ClipboardCheck, Activity,
  Gauge, Server, Building2, ClipboardList, Inbox, Mail
} from "lucide-react";

const ROLE_LEVELS = {
  platform_owner: 100,
  organisation_admin: 50,
  sales_manager: 30,
  bdm: 10,
  reporting_user: 10,
};

const MAIN_NAV = [
  { to: "/app", label: "Today", icon: CalendarCheck, minLevel: 10 },
  { to: "/contacts", label: "Contacts", icon: Users, minLevel: 10 },
  { to: "/dialer", label: "Dialer", icon: Phone, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/results", label: "Results", icon: BarChart3, minLevel: 10 },
  { to: "/campaigns", label: "Campaigns", icon: ClipboardList, minLevel: 30 },
  { to: "/team", label: "Team", icon: UserCog, minLevel: 30 },
  { to: "/manager-inbox", label: "Admin inbox", icon: Inbox, minLevel: 50 },
  { to: "/outreach", label: "Outreach", icon: Mail, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, minLevel: 50 },
  { to: "/onboarding", label: "Get Started", icon: ListChecks, minLevel: 10 },
];

const PLATFORM_NAV = [
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

// Bottom tab bar for mobile — shows the 4 most-used caller pages + a "More"
// overlay with the full navigation. Fixed to the bottom with safe-area padding.
export default function MobileNav() {
  const { pathname } = useLocation();
  const { logout, user, workspaceAccess } = useAuth();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const userLevel = ROLE_LEVELS[user?.app_role] || 0;
  const isPlatform = user?.app_role === "platform_owner";

  const canDial = user?.app_role !== "reporting_user";
  const tabs = [
    { to: "/app", label: "Today", icon: CalendarCheck },
    { to: "/contacts", label: "Contacts", icon: Users },
    ...(canDial ? [{ to: "/dialer", label: "Dialer", icon: Phone }] : []),
    { to: "/results", label: "Results", icon: BarChart3 },
  ];

  const moreLinks = workspaceAccess?.read_only
    ? [{ to: "/expired", label: "Export & Upgrade", icon: ListChecks }]
    : MAIN_NAV.filter(
        (item) =>
          ((item.to === '/outreach' || item.to === '/lead-sheets') && user?.app_role === 'internal_bd' || userLevel >= item.minLevel) &&
          !(item.excludeRoles || []).includes(user?.app_role) &&
          !tabs.find((t) => t.to === item.to)
      );

  const allMoreLinks = [...moreLinks];
  if (isPlatform) {
    allMoreLinks.push({ to: "__platform__", label: "Platform Tools", icon: Server, isHeader: true });
    allMoreLinks.push(...PLATFORM_NAV);
  }

  const isActive = (to) => {
    if (to === "/app") return pathname === "/app";
    return pathname.startsWith(to);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.to);
          return (
            <Link key={tab.to} to={tab.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active ? "text-slate-900" : "text-slate-400"
              }`}>
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
            moreOpen ? "text-slate-900" : "text-slate-400"
          }`}>
          <Menu className="w-5 h-5" strokeWidth={moreOpen ? 2.5 : 2} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[75vh] overflow-y-auto"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="font-display text-lg font-semibold text-slate-900">All pages</p>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {allMoreLinks.map((item) => {
                if (item.isHeader) {
                  return (
                    <div key={item.label} className="col-span-2 mt-3 mb-1">
                      <p className="text-xs uppercase tracking-widest text-slate-400 px-2">{item.label}</p>
                    </div>
                  );
                }
                const active = isActive(item.to);
                return (
                  <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="px-4 pb-4 pt-2 border-t border-slate-200">
              <Link to="/support" onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm text-slate-700 hover:bg-slate-50">
                <LifeBuoy className="w-4 h-4" /> Support
              </Link>
              <button onClick={() => { setMoreOpen(false); logout(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm text-rose-600 hover:bg-rose-50">
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}