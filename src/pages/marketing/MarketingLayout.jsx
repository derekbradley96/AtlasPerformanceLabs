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
        className="flex-shrink-0 border-b"
        style={{
          borderColor: colors.border,
          backdropFilter: 'blur(18px)',
          background: `radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 60%)`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2" aria-label="Atlas Home">
            <AtlasLogo variant="inline" />
            <span
              className="hidden sm:inline text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: colors.muted }}
            >
              PERFORMANCE LABS
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: colors.text }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer
        className="flex-shrink-0 border-t"
        style={{ borderColor: colors.border }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6">
          <span className="text-sm" style={{ color: colors.muted }}>
            © Atlas Performance Labs
          </span>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link to="/for-coaches" style={{ color: colors.muted }}>For Coaches</Link>
            <Link to="/for-athletes" style={{ color: colors.muted }}>For Athletes</Link>
            <Link to="/pricing" style={{ color: colors.muted }}>Pricing</Link>
            <Link to="/marketplace" style={{ color: colors.muted }}>Marketplace</Link>
            <Link to="/login" style={{ color: colors.primary }}>Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
