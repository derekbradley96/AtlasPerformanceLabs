/**
 * Simple marketing layout: header (logo + nav), main outlet, footer, CTA strip.
 */
import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { colors } from '@/ui/tokens';
import AtlasLogo from '@/components/Brand/AtlasLogo';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/for-coaches', label: 'For Coaches' },
  { to: '/for-athletes', label: 'For Athletes' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/login', label: 'Login' },
];

export default function MarketingLayout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
      <header
        className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        <Link to="/" className="flex items-center" aria-label="Atlas Home">
          <AtlasLogo variant="inline" />
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{ color: colors.text }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer
        className="flex-shrink-0 border-t py-6 px-4"
        style={{ borderColor: colors.border }}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm" style={{ color: colors.muted }}>
            © Atlas Performance Labs
          </span>
          <div className="flex gap-4">
            <Link to="/for-coaches" className="text-sm" style={{ color: colors.muted }}>For Coaches</Link>
            <Link to="/for-athletes" className="text-sm" style={{ color: colors.muted }}>For Athletes</Link>
            <Link to="/pricing" className="text-sm" style={{ color: colors.muted }}>Pricing</Link>
            <Link to="/login" className="text-sm" style={{ color: colors.primary }}>Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
