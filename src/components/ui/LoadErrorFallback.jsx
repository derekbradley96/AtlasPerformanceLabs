/**
 * User-friendly fallback when a screen's data load fails (dashboard, clients, messages, programs).
 * Offers Retry and Go home; keeps layout consistent with app shell.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, shell } from '@/ui/tokens';
import Button from '@/ui/Button';

export default function LoadErrorFallback({
  title = 'Something went wrong',
  description = "We couldn't load this content. Check your connection and try again.",
  onRetry,
  showGoHome = true,
}) {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        padding: spacing[32],
        minHeight: 280,
        background: colors.card,
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        boxShadow: shell.cardShadow,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: shell.cardRadius,
          background: 'rgba(239,68,68,0.12)',
          color: colors.danger ?? '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[16],
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[8] }}>
        {title}
      </p>
      <p style={{ fontSize: 14, color: colors.muted, margin: 0, marginBottom: spacing[24], maxWidth: 320 }}>
        {description}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
        {typeof onRetry === 'function' && (
          <Button variant="primary" onClick={onRetry} style={{ width: '100%' }}>
            Try again
          </Button>
        )}
        {showGoHome && (
          <Button
            variant="secondary"
            onClick={() => navigate('/home')}
            style={{ width: '100%' }}
          >
            Go to dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
