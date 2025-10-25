import { useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  LifeBuoy,
  List,
  LogOut,
  Menu,
  PhoneCall,
  ServerCog,
  Settings,
  UserCog,
  X,
  LayoutDashboard,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dialer', label: 'Dialer', icon: PhoneCall },
  { to: '/call-logs', label: 'Call Logs', icon: List },
  { to: '/event-logs', label: 'Event Logs', icon: Activity },
  { to: '/voice-workspace', label: 'Voice Workspace', icon: ServerCog },
  { to: '/advanced-config', label: 'Advanced Config', icon: UserCog },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/contact', label: 'Contact Us', icon: LifeBuoy },
];

export function AppLayout() {
  const { user, signOutUser } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const emailLabel = useMemo(() => {
    if (!user?.email) return 'guest';
    return `${user.email} ${user.emailVerified ? '(Verified)' : '(Unverified)'}`;
  }, [user?.email, user?.emailVerified]);

  const renderNavLinks = (onNavigate) =>
    navigation.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-800 ${
              isActive ? 'bg-slate-800 text-brand-light' : 'text-slate-300'
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      );
    });

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900/60 p-6 lg:flex">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-brand">Twilio Voice Console</h1>
          <p className="text-sm text-slate-400">Connected as {emailLabel}</p>
        </div>
        <nav className="flex-1 space-y-2">{renderNavLinks()}</nav>
        <Button variant="outline" onClick={() => signOutUser()} className="mt-auto justify-start gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </aside>
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-64 flex-col border-r border-slate-800 bg-slate-900/95 p-6">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-brand">Twilio Voice Console</h1>
                <p className="text-xs text-slate-400">Connected as {emailLabel}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeMobileNav} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto">{renderNavLinks(closeMobileNav)}</nav>
            <Button variant="outline" onClick={() => { closeMobileNav(); signOutUser(); }} className="mt-6 justify-start gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
          <button
            type="button"
            className="flex-1 bg-black/40"
            onClick={closeMobileNav}
            aria-label="Close navigation"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-slate-400">Twilio Voice Console</span>
              <span className="text-lg font-semibold">Web Dialer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-sm text-slate-400 sm:block">{emailLabel}</div>
            <Button size="sm" variant="outline" onClick={() => signOutUser()}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}


