import { Link, useLocation } from 'react-router-dom';
import { History, Home, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

const nav = [
  { name: 'Home', path: 'Home', icon: Home },
  { name: 'Start a new cadence', path: 'NewDecision', icon: Sparkles },
  { name: 'History', path: 'History', icon: History },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const current = pathname.replace(/^\//, '') || 'Home';

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to={createPageUrl('Home')} className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            Cadence
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = current.toLowerCase() === item.path.toLowerCase();
              return (
                <Link key={item.path} to={createPageUrl(item.path)}>
                  <Button variant={active ? 'default' : 'ghost'} className={active ? 'bg-blue-600 hover:bg-blue-700' : ''}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
            <Button variant="ghost" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-around py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = current.toLowerCase() === item.path.toLowerCase();
            return (
              <Link key={item.path} to={createPageUrl(item.path)}>
                <button className={`flex flex-col items-center gap-1 px-4 py-2 ${active ? 'text-blue-600' : 'text-slate-500'}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.name === 'Start a new cadence' ? 'New' : item.name}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="pb-20 md:pb-0">{children}</main>

      <footer className="mt-20 bg-slate-900 py-8 text-slate-400">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">© {new Date().getFullYear()} Cadence. Intelligent communication decision-support for leaders.</p>
        </div>
      </footer>
    </div>
  );
}
