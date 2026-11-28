import React, { useState, lazy, Suspense } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  CalendarCheck, Users, BarChart3, ClipboardList, UserCog, Settings as SettingsIcon,
  Rocket, MessageSquare, Flag, AlertTriangle, ClipboardCheck, Activity,
  Gauge, Server, Building2, LifeBuoy, LogOut, ChevronDown, LockKeyhole,
  UserCircle, Phone, Inbox, Mail,
  Sun, Moon
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import MobileNav from "@/components/MobileNav";
import EnrichmentProgressIndicator from "@/components/EnrichmentProgressIndicator";
import { useTheme } from "@/hooks/useTheme";

const ReportProblemDialog = lazy(() => import("@/components/support/ReportProblemDialog"));
const FeedbackDialog = lazy(() => import("@/components/support/FeedbackDialog"));
const UsageGateModal = lazy(() => import("@/components/billing/UsageGateModal"));

const ROLE_LEVELS = {
  platform_owner: 100,
  organisation_admin: 50,
  sales_manager: 30,
  bdm: 10,
  reporting_user: 10,
};

const MAIN_NAV = [
  { to: "/app", label: "Today", icon: CalendarCheck, minLevel: 10 },
  { to: "/dialer", label: "Dialer", icon: Phone, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/campaigns", label: "Campaigns", icon: ClipboardList, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/contacts", label: "Contacts", icon: Users, minLevel: 10 },
  { to: "/results", label: "Results", icon: BarChart3, minLevel: 10 },
  { to: "/team", label: "Team", icon: UserCog, minLevel: 30 },
  { to: "/manager-inbox", label: "Admin inbox", icon: Inbox, minLevel: 50 },
  { to: "/outreach", label: "Outreach", icon: Mail, minLevel: 10, excludeRoles: ["reporting_user"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, minLevel: 50 },
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

export default function Layout() {
  const { pathname } = useLocation();
  const { logout, user, workspaceAccess } = useAuth();
  const [showReport, setShowReport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const userLevel = ROLE_LEVELS[user?.app_role] || 0;
  const isPlatform = user?.app_role === "platform_owner";
  const navVisible = (item) =>
    (item.to === '/outreach' && user?.app_role === 'internal_bd') ||
    (item.to === '/lead-sheets' && user?.app_role === 'internal_bd') ||
    (userLevel >= item.minLevel && !(item.excludeRoles || []).includes(user?.app_role));

  const mainNav = workspaceAccess?.read_only
    ? [{ to: "/expired", label: "Export & Upgrade", icon: LockKeyhole, minLevel: 0 }]
    : MAIN_NAV.filter(navVisible);

  const renderNavLink = (item) => {
    const active = pathname === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all whitespace-nowrap ${
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        <item.icon className="w-4 h-4" />
        <span className="hidden sm:inline">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link to="/app" className="font-display text-lg tracking-tight font-semibold text-slate-900 flex-shrink-0">
            Cadence<span className="text-emerald-600">.</span>
          </Link>


          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            {mainNav.map(renderNavLink)}
          </nav>

          {/* Mobile — compact header, bottom nav handles page navigation */}
          <div className="md:hidden flex-1" />

          <div className="ml-auto flex items-center gap-1">
            <EnrichmentProgressIndicator />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Currently in ${theme === "dark" ? "night" : "day"} mode — click to switch`}
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-indigo-300" style={{ filter: "drop-shadow(0 0 5px rgba(165,180,252,0.9))" }} />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.9))" }} />
              )}
            </button>
            {/* Platform menu */}
            {isPlatform && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-slate-600 hover:bg-slate-100 whitespace-nowrap">
                    <Server className="w-4 h-4" />
                    <span className="hidden sm:inline">Platform</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-slate-400">Platform tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PLATFORM_NAV.map(item => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" /> {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User/help menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-slate-600 hover:bg-slate-100 whitespace-nowrap">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                    {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown className="w-3 h-3 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-slate-400">
                  {user?.full_name || user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowReport(true); }}>
                  <Flag className="w-4 h-4 mr-2" /> Report a problem
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowFeedback(true); }}>
                  <MessageSquare className="w-4 h-4 mr-2" /> Give feedback
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <UserCircle className="w-4 h-4 mr-2" /> My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/support" className="flex items-center">
                    <LifeBuoy className="w-4 h-4 mr-2" /> Support
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout(true)}>
                  <LogOut className="w-4 h-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 md:px-5 py-6 md:py-8 pb-24 md:pb-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-5 py-4 text-center text-xs text-slate-400">
          Designed by{" "}
          <a
            href="https://smartfunction.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-700 transition-colors"
          >
            © SMARTFUNCTION 2026
          </a>
        </div>
      </footer>
      <MobileNav />
      <Suspense fallback={null}>
        {showReport && <ReportProblemDialog open={showReport} onOpenChange={setShowReport} />}
        {showFeedback && <FeedbackDialog open={showFeedback} onOpenChange={setShowFeedback} />}
        <UsageGateModal />
      </Suspense>
    </div>
  );
}