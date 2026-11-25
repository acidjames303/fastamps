import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LifeBuoy, LogOut, Server, LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  MAIN_NAV,
  SECONDARY_NAV,
  PLATFORM_NAV,
  MOBILE_TABS,
  ROLE_LEVELS,
  navVisible,
  isNavActive,
} from "@/lib/navConfig";

// Bottom tab bar for mobile — primary everyday pages + a "More" drawer.
export default function MobileNav() {
  const { pathname, search } = useLocation();
  const { logout, user, workspaceAccess } = useAuth();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const userLevel = ROLE_LEVELS[user?.app_role] || 0;
  const isPlatform = user?.app_role === "platform_owner";
  const visible = (item) => navVisible(item, user, userLevel);

  const tabs = workspaceAccess?.read_only
    ? [{ to: "/expired", label: "Export", icon: LockKeyhole }]
    : MOBILE_TABS.filter(visible);

  const tabPaths = new Set(tabs.map((t) => t.to.split("?")[0]));

  const moreLinks = workspaceAccess?.read_only
    ? []
    : [
        ...MAIN_NAV.filter(visible).filter((item) => !tabPaths.has(item.to.split("?")[0])),
        ...SECONDARY_NAV.filter(visible),
      ];

  const allMoreLinks = [...moreLinks];
  if (isPlatform) {
    allMoreLinks.push({ to: "__platform__", label: "Platform tools", icon: Server, isHeader: true });
    allMoreLinks.push(...PLATFORM_NAV);
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isNavActive(pathname, search, tab);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active ? "text-slate-900" : "text-slate-400"
              }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
            moreOpen ? "text-slate-900" : "text-slate-400"
          }`}
        >
          <Menu className="w-5 h-5" strokeWidth={moreOpen ? 2.5 : 2} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[75vh] overflow-y-auto"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="font-display text-lg font-semibold text-slate-900">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100">
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
                const active = isNavActive(pathname, search, item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="px-4 pb-4 pt-2 border-t border-slate-200">
              <Link
                to="/support"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm text-slate-700 hover:bg-slate-50"
              >
                <LifeBuoy className="w-4 h-4" /> Support
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  logout(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
