/**
 * Recoverable boot error UI: message + Retry + Sign out.
 * Used when boot times out (10s) or throws, so the app never infinite-spins.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { colors } from '@/ui/tokens';

export default function BootErrorScreen({ bootError: bootErrorProp }) {
  const { logout, clearLoadingFlags, bootError: authBootError } = useAuth();
  const navigate = useNavigate();
  const bootError = bootErrorProp ?? authBootError;

  const handleRetry = () => {
    if (typeof clearLoadingFlags === 'function') clearLoadingFlags();
    window.location.reload();
  };
  const handleSignOut = async () => {
    if (typeof logout === 'function') await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <p className="text-center font-medium">Couldn&apos;t finish loading.</p>
      <p className="text-sm text-center opacity-80" style={{ color: colors.muted }}>Boot timed out or failed. Check network and try again.</p>
      {bootError && (
        <p className="text-xs text-center opacity-90 max-w-md" style={{ wordBreak: 'break-word', color: colors.muted }} title={bootError}>
          {import.meta.env.DEV ? bootError : String(bootError).slice(0, 80)}
        </p>
      )}
      <p className="text-xs text-center opacity-70" style={{ color: colors.muted }}>Retry or sign out and try again.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleRetry}
          className="px-4 py-2.5 rounded-xl font-medium border border-white/20"
          style={{ background: 'rgba(255,255,255,0.1)', color: colors.text }}
        >
          Retry
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="px-4 py-2.5 rounded-xl font-medium text-white"
          style={{ background: colors.accent }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
