/**
 * Admin layout: nav links + outlet. Matches main app shell (safe area, header height, padding).
 * Only rendered when user is admin (profile.is_admin).
 */
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { colors, shell } from '@/ui/tokens';
import { LayoutDashboard, Users, UserCheck, MessageSquare, BarChart3, Search } from 'lucide-react';

const HEADER_HEIGHT = shell.headerHeight;

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', end: false, label: 'Users', icon: Users },
  { to: '/admin/lookup', end: false, label: 'User lookup', icon: Search },
  { to: '/admin/coaches', end: false, label: 'Coaches', icon: UserCheck },
  { to: '/admin/feedback', end: false, label: 'Feedback', icon: MessageSquare },
  { to: '/admin/metrics', end: false, label: 'Metrics', icon: BarChart3 },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  if (!profile?.is_admin) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: colors.bg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="text-center">
          <p style={{ color: colors.text }}>Access denied. Admin only.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 rounded-xl py-2 px-4 text-sm font-medium"
            style={{ background: colors.primarySubtle, color: colors.primary }}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col w-full max-w-full min-w-0"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {/* Header: same safe-area + height as AppShell so back button is below status bar */}
      <header
        className="flex-shrink-0 border-b sticky top-0 z-50"
        style={{
          borderColor: colors.border,
          paddingTop: 'env(safe-area-inset-top, 0)',
          height: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          minHeight: HEADER_HEIGHT,
          background: colors.bg,
        }}
      >
        <div
          className="flex items-center justify-between w-full"
          style={{
            height: HEADER_HEIGHT,
            minHeight: HEADER_HEIGHT,
            paddingLeft: shell.pagePaddingH,
            paddingRight: shell.pagePaddingH,
          }}
        >
          <div className="flex items-center" style={{ minWidth: 88, minHeight: 44 }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: colors.muted,
                background: 'transparent',
                border: 'none',
              }}
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <h1
            className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold truncate max-w-[50%]"
            style={{ color: colors.text }}
          >
            Admin
          </h1>
          <div style={{ minWidth: 88, minHeight: 44 }} aria-hidden />
        </div>
      </header>

      <nav
        className="flex-shrink-0 overflow-x-auto border-b flex gap-1"
        style={{
          borderColor: colors.border,
          paddingLeft: shell.pagePaddingH,
          paddingRight: shell.pagePaddingH,
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex items-center gap-2 rounded-lg py-2 px-3 text-sm font-medium whitespace-nowrap"
            style={({ isActive }) => ({
              background: isActive ? colors.primarySubtle : 'transparent',
              color: isActive ? colors.primary : colors.text,
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: shell.topSpacing,
          paddingBottom: 24,
          paddingLeft: shell.pagePaddingH,
          paddingRight: shell.pagePaddingH,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
