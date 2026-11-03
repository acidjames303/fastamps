import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Camera, ListChecks, Wallet, User, Users, ShieldCheck, QrCode, BarChart3,
  FlaskConical, ChevronDown, LogOut, ShieldHalf, ShieldAlert, ClipboardCheck, Menu,
  GraduationCap, Trophy, Briefcase, MessageCircle, FileText, MoreHorizontal,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import ThemeToggle from '@/components/ThemeToggle';
import BrandLogo from '@/components/BrandLogo';
import MoreDrawer from '@/components/mobile/MoreDrawer';
import SubpageBackBar from '@/components/mobile/SubpageBackBar';
import { AdminMobilePanes, InstallerMobilePanes } from '@/components/mobile/MobileTabPanes';
import {
  isPrimaryTabPath,
  saveTabScroll,
  tabKeyForPath,
} from '@/lib/tabScrollMemory';

const SUBPAGE_TITLES = {
  '/profile': 'Profile',
  '/academy': 'Academy',
  '/opportunities': 'Opportunities',
  '/leaderboard': 'Leaderboard',
  '/coach': 'Coach',
  '/programme-terms': 'Programme terms',
  '/admin/chargers': 'QR batches',
  '/admin/fraud-review': 'Fraud review',
  '/admin/reports': 'Reports',
  '/admin/beta-test': 'Beta test',
  '/admin/qa': 'QA checklist',
};

const installerDesktopNav = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/register-install', label: 'Register', icon: Camera },
  { to: '/installs', label: 'Installs', icon: ListChecks },
  { to: '/earnings', label: 'Rewards', icon: Wallet },
  { to: '/profile', label: 'Profile', icon: User },
];

const installerMoreItems = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/academy', label: 'Academy', icon: GraduationCap },
  { to: '/opportunities', label: 'Opportunities', icon: Briefcase },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/coach', label: 'Coach', icon: MessageCircle },
  { to: '/programme-terms', label: 'Programme terms', icon: FileText },
];

const adminNav = [
  { to: '/admin/beta-test', label: 'Beta test', icon: FlaskConical },
  { to: '/admin/qa', label: 'QA checklist', icon: ClipboardCheck },
  { to: '/admin/installers', label: 'Installers', icon: Users },
  { to: '/admin/installs', label: 'Review installs', icon: ShieldCheck },
  { to: '/admin/chargers', label: 'QR batches', icon: QrCode },
  { to: '/admin/vouchers', label: 'Vouchers', icon: Wallet },
  { to: '/admin/fraud-review', label: 'Fraud review', icon: ShieldAlert },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

const adminMobilePrimary = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/admin/installs', label: 'Installs', icon: ShieldCheck },
  { to: '/admin/installers', label: 'Installers', icon: Users },
  { to: '/admin/vouchers', label: 'Vouchers', icon: Wallet },
];

const adminMoreItems = [
  { to: '/admin/chargers', label: 'QR batches', icon: QrCode },
  { to: '/admin/fraud-review', label: 'Fraud review', icon: ShieldAlert },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/beta-test', label: 'Beta test', icon: FlaskConical },
  { to: '/admin/qa', label: 'QA checklist', icon: ClipboardCheck },
  { to: '/profile', label: 'Profile', icon: User },
];

const installerMobilePrimary = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/register-install', label: 'Register', icon: Camera },
  { to: '/installs', label: 'Installs', icon: ListChecks },
  { to: '/earnings', label: 'Wallet', icon: Wallet },
];

export default function Layout() {
  const { data } = useInstaller();
  const isAdmin = data?.user?.role === 'admin';
  const location = useLocation();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const adminActive = location.pathname === '/' || adminNav.some(({ to }) => location.pathname.startsWith(to));
  const onPrimaryTab = isPrimaryTabPath(location.pathname, isAdmin);
  const moreItems = isAdmin ? adminMoreItems : installerMoreItems;
  const moreActive = !onPrimaryTab && moreItems.some(({ to }) => location.pathname === to || location.pathname.startsWith(`${to}/`));

  const mobileTabs = useMemo(
    () => (isAdmin ? adminMobilePrimary : installerMobilePrimary),
    [isAdmin],
  );

  // Close More drawer after navigation settles on a primary tab.
  useEffect(() => {
    if (onPrimaryTab) setMoreOpen(false);
  }, [onPrimaryTab, location.pathname]);

  const goTab = (to) => {
    const currentKey = tabKeyForPath(location.pathname, isAdmin);
    if (currentKey) saveTabScroll(currentKey);
    if (location.pathname === to) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(to);
  };

  return (
    <div className="min-h-dvh app-bg text-foreground font-body ios-shell">
      <header className="pt-safe sticky top-0 z-40 backdrop-blur-xl bg-background/90 border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 h-20 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" aria-label={isAdmin ? 'Go to admin overview' : 'Go to installer home'} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <BrandLogo className="h-12 w-24 min-[390px]:w-36 sm:h-20 sm:w-56 shrink-0" />
            <div className="block min-w-0 border-l border-border pl-2 sm:pl-2.5 sm:pl-3 leading-none self-center">
              <div className="font-semibold tracking-tight text-sm sm:text-lg text-foreground">Connect</div>
              <div className="text-[7px] min-[390px]:text-[8px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.22em] mt-1 font-semibold text-accent">The network that pays</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {!isAdmin && installerDesktopNav.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${isActive ? 'text-white bg-primary shadow-[0_0_18px_-6px_hsl(var(--primary))]' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
                {label}
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <NavLink to="/" end className={({ isActive }) => `px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${isActive ? 'text-white bg-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
                  Overview
                </NavLink>
                <div className="relative ml-1" onMouseLeave={() => setAdminOpen(false)}>
                  <button
                    type="button"
                    onClick={() => setAdminOpen((v) => !v)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap ${adminActive ? 'text-white bg-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
                    <ShieldHalf className="w-4 h-4" />
                    Admin
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {adminOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setAdminOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-popover shadow-xl shadow-black/40 py-1.5 z-20">
                        {adminNav.map(({ to, label, icon: Icon }) => (
                          <NavLink key={to} to={to} onClick={() => setAdminOpen(false)}
                            className={({ isActive }) => `flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${isActive ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                          </NavLink>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            <ThemeToggle />
            <button type="button" onClick={() => base44.auth.logout(window.location.origin + '/login')} className="ml-1 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </nav>

          <div className="flex md:hidden shrink-0 items-center gap-1">
            <ThemeToggle />
            <button type="button" onClick={() => base44.auth.logout(window.location.origin + '/login')} className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" title="Sign out" aria-label="Sign out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 pt-8 pb-safe-nav min-h-[50dvh]">
        {/* Desktop / tablet: standard router outlet */}
        <div className="hidden md:block page-enter">
          <Outlet />
        </div>

        {/* Mobile: keep primary tab screens mounted; outlet for More destinations */}
        <div className="md:hidden">
          {isAdmin ? (
            <AdminMobilePanes active={onPrimaryTab} />
          ) : (
            <InstallerMobilePanes active={onPrimaryTab} />
          )}
          {!onPrimaryTab ? (
            <div className="page-enter">
              <SubpageBackBar
                title={SUBPAGE_TITLES[location.pathname] || 'Back'}
                fallbackTo="/"
              />
              <Outlet />
            </div>
          ) : null}
        </div>
      </main>

      <nav
        className="no-native-select pb-safe md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 px-1">
          {mobileTabs.map(({ to, label, icon: Icon }) => {
            const active = tabKeyForPath(location.pathname, isAdmin) === to;
            return (
              <button
                key={to}
                type="button"
                onClick={() => goTab(to)}
                className={`py-2.5 flex flex-col items-center gap-1 text-[10px] transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const currentKey = tabKeyForPath(location.pathname, isAdmin);
              if (currentKey) saveTabScroll(currentKey);
              setMoreOpen(true);
            }}
            className={`py-2.5 flex flex-col items-center gap-1 text-[10px] transition-colors ${moreActive || moreOpen ? 'text-primary' : 'text-muted-foreground'}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            {moreOpen ? <MoreHorizontal className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            More
          </button>
        </div>
      </nav>

      <MoreDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={moreItems}
        title={isAdmin ? 'Admin more' : 'More'}
      />

      <footer className="hidden md:block max-w-6xl mx-auto px-5 py-4 text-center text-[11px] text-muted-foreground/60">
        Designed by ©jpriches 2026
      </footer>
    </div>
  );
}
