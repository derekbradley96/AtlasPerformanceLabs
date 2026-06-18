import React from 'react';
import AtlasLogo from '@/components/Brand/AtlasLogo';
import { colors, spacing } from '@/ui/tokens';
import { usePresentationMode } from '@/lib/presentationMode';

export default function GoodbyePage() {
  const { isDesktopWeb } = usePresentationMode();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing[24]}px ${spacing[16]}px`,
      }}
    >
      <div style={{ width: '100%', maxWidth: isDesktopWeb ? 520 : 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing[20] }}>
          <AtlasLogo variant="auth" />
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: colors.text }}>Your account has been deleted.</h1>
        <p style={{ margin: `${spacing[12]}px 0 0`, color: colors.muted, lineHeight: 1.5 }}>
          Thanks for being part of Atlas.
        </p>
        <p style={{ margin: `${spacing[8]}px 0 0`, color: colors.muted, lineHeight: 1.5 }}>
          We've noted your feedback and we'll use it to keep improving.
        </p>
        <p style={{ margin: `${spacing[8]}px 0 0`, color: colors.muted, lineHeight: 1.5 }}>
          If you ever want to come back, you're always welcome.
        </p>
        <a
          href="https://atlasperformancelabs.co.uk"
          style={{
            display: 'inline-block',
            marginTop: spacing[20],
            color: colors.primary,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          atlasperformancelabs.co.uk
        </a>
      </div>
    </div>
  );
}
