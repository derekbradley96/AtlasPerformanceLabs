/**
 * Simple marketing layout: header (logo + nav), main outlet, footer, CTA strip.
 */
import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { colors } from '@/ui/tokens';
import { getStandaloneScrollablePagePaddingBottom } from '@/ui/pageLayout';
import { LOGIN_PUBLIC_PATH, SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { clearAuthEntryCarryover } from '@/lib/onboardingStatus';
import AtlasLogo from '@/components/Brand/AtlasLogo';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/for-coaches', label: 'Coaches' },
  { to: '/for-clients', label: 'Clients' },
  { to: '/personal', label: 'Personal' },
  { to: '/pricing', label: 'Pricing' },
  // Marketplace hidden until coaches are listed.
  // Restore when is_marketplace_listed coaches exist.
  { to: '/affiliates', label: 'Partners' },
  { to: '/why-switch', label: 'Why Switch' },
  { to: '/blog', label: 'Blog' },
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
          </Link>
          <div className="flex flex-wrap items-center gap-2">
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
            <Link
              to={LOGIN_PUBLIC_PATH}
              onClick={clearAuthEntryCarryover}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: colors.text }}
            >
              Login
            </Link>
            <Link
              to={SIGNUP_PUBLIC_PATH}
              className="px-3 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: colors.primary, color: '#fff' }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1" style={{ paddingBottom: getStandaloneScrollablePagePaddingBottom() }}>
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
            <Link to="/for-coaches" style={{ color: colors.muted }}>Coaches</Link>
            <Link to="/for-clients" style={{ color: colors.muted }}>Clients</Link>
            <Link to="/personal" style={{ color: colors.muted }}>Personal</Link>
            <Link to="/pricing" style={{ color: colors.muted }}>Pricing</Link>
            <Link to="/discover" style={{ color: colors.muted }}>Find a coach</Link>
            <Link to="/affiliates" style={{ color: colors.muted }}>Partners</Link>
            <Link to="/why-switch" style={{ color: colors.muted }}>Why Switch</Link>
            <Link to="/blog" style={{ color: colors.muted }}>Blog</Link>
            <Link to="/privacy" style={{ color: colors.muted }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: colors.muted }}>Terms of Service</Link>
            <Link to={LOGIN_PUBLIC_PATH} onClick={clearAuthEntryCarryover} style={{ color: colors.primary }}>Login</Link>
            <Link to={SIGNUP_PUBLIC_PATH} style={{ color: colors.primary }}>Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
