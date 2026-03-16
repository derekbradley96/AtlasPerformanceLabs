/**
 * At "/": show loading until auth ready; then redirect logged-in users to app /home, else show marketing outlet.
 * Uses a static loading view (no redirect) so unauthenticated users see marketing after load.
 */
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { colors } from '@/ui/tokens';
import AtlasLogo from '@/components/Brand/AtlasLogo';

function MarketingLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: colors.bgPrimary,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.brand}22 0%, transparent 70%)`,
        }}
      />
      <AtlasLogo variant="splash" wrapperStyle={{ position: 'relative' }} />
      <div
        style={{
          marginTop: 24,
          width: 24,
          height: 24,
          border: `2px solid ${colors.border}`,
          borderTopColor: colors.accentGlow,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function MarketingGate() {
  const { authReady, isAuthenticated, role } = useAuth();
  const hasRole = role === 'coach' || role === 'client' || role === 'personal' || role === 'trainer' || role === 'solo';

  if (!authReady) return <MarketingLoading />;
  if (isAuthenticated && hasRole) return <Navigate to="/home" replace />;
  return <Outlet />;
}
