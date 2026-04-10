/**
 * Personal-mode shells: desktop = premium column on subtle canvas; mobile = full-bleed + safe gutters.
 *
 * - `PersonalSurface`: one import for full pages without a full-bleed top bar (Home, Today, Nutrition hub, More). Use `variant="home"` for Personal Home on web (wider dashboard column).
 * - `PersonalCanvas` + `PersonalColumn`: when `TopBar` (or another full-width chrome) must sit outside the column.
 * - Non-personal roles: all exports render `children` unchanged (no layout side effects).
 */
import React from 'react';
import { usePresentationMode } from '@/lib/presentationMode';
import { isPersonal } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import { personalCanvasRootStyle, personalMainColumnStyle } from '@/lib/personalShellLayout';

export function PersonalColumn({ children, variant = 'default' }) {
  const { isDesktopWeb, isWideWeb, native } = usePresentationMode();
  const { effectiveRole } = useAuth();
  if (!isPersonal(effectiveRole)) return children;
  return <div style={personalMainColumnStyle({ isDesktopWeb, isWideWeb, native, variant })}>{children}</div>;
}

export function PersonalCanvas({ children }) {
  const { isDesktopWeb, isWideWeb } = usePresentationMode();
  const { effectiveRole } = useAuth();
  if (!isPersonal(effectiveRole)) return children;
  return <div style={personalCanvasRootStyle(isDesktopWeb, isWideWeb)}>{children}</div>;
}

/** Full page (no full-bleed header): canvas + column in one. */
export default function PersonalSurface({ children, variant = 'default' }) {
  const { effectiveRole } = useAuth();
  if (!isPersonal(effectiveRole)) return children;
  return (
    <PersonalCanvas>
      <PersonalColumn variant={variant}>{children}</PersonalColumn>
    </PersonalCanvas>
  );
}
