/**
 * Admin layout: nav links + outlet. Only rendered when user is admin (profile.is_admin).
 */
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { colors, spacing, shell } from '@/ui/tokens';
import { LayoutDashboard, Users, UserCheck, MessageSquare, BarChart3, ArrowLeft } from 'lucide-react';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', end: false, label: 'Users', icon: Users },
  { to: '/admin/coaches', end: false, label: 'Coaches', icon: UserCheck },
  { to: '/admin/feedback', end: false, label: 'Feedback', icon: MessageSquare },
  { to: '/admin/metrics', end: false, label: 'Metrics', icon: BarChart3 },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
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
    <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
      <header className="flex-shrink-0 border-b flex items-center justify-between gap-4 px-4 py-3" style={{ borderColor: colors.border }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: colors.muted }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>Admin</h1>
        <div className="w-16" />
      </header>
      <nav className="flex-shrink-0 overflow-x-auto border-b px-4 py-2 flex gap-1" style={{ borderColor: colors.border }}>
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
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
