import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import AtlasLogo from '@/components/Brand/AtlasLogo';
import { colors } from '@/ui/tokens';

const isDev = import.meta.env.DEV;

export default function Login() {
  const navigate = useNavigate();
  const { enterDemo, isAuthenticated, navigateToLogin } = useAuth();
  const [redirectError, setRedirectError] = useState(null);

  const handleSignIn = () => {
    setRedirectError(null);
    if (isDev) {
      setRedirectError('Dev mode: backend auth not connected. Use Continue in Demo Mode below.');
      return;
    }
    navigateToLogin();
  };

  const handleDemoMode = (e) => {
    e?.preventDefault?.();
    enterDemo('coach');
    navigate(createPageUrl('Home'));
  };

  // Always render visible UI; never return null or block on async
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: 'max(24px, env(safe-area-inset-top, 0))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0))',
      }}
    >
      <div className="w-full">
        <div className="flex items-center gap-3 mb-6">
          <AtlasLogo variant="header" className="shrink-0" />
          <span className="text-base font-semibold" style={{ color: colors.text }}>Sign in</span>
        </div>

        <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-6 space-y-4">
          <p className="text-slate-400 text-sm">
            Sign in with your account to continue.
          </p>

          {isAuthenticated && (
            <div className="rounded-lg bg-atlas-accent/10 border border-atlas-accent/20 p-3 text-sm text-slate-300 text-center">
              You&apos;re already signed in.
            </div>
          )}

          {isDev && (
            <div className="rounded-lg bg-slate-800/80 border border-atlas-border p-3 text-sm text-slate-300 text-center">
              Dev mode: backend auth not connected
            </div>
          )}

          {redirectError && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-600/30 p-3 text-sm text-amber-200 text-center">
              {redirectError}
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              className="w-full min-h-[44px] bg-atlas-accent hover:bg-atlas-accent/90 text-white font-medium"
              onClick={handleSignIn}
            >
              Sign in
            </Button>
            {isDev && (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[44px] border-atlas-border text-slate-300 hover:bg-atlas-surface"
                onClick={handleDemoMode}
              >
                Continue in Demo Mode
              </Button>
            )}
            {isAuthenticated && (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[44px] border-atlas-border text-slate-300 hover:bg-atlas-surface"
                onClick={() => navigate(createPageUrl('Home'))}
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        </div>

        <p className="text-slate-500 text-center text-xs mt-6">
          Atlas Performance Labs · Sign-in is handled securely via your account provider.
        </p>
      </div>
    </div>
  );
}
