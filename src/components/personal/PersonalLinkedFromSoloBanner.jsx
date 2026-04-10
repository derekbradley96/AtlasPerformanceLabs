import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { personalCoachTransitionCopy } from '@/lib/personalToClientTransition';

const DISMISS_KEY = 'atlas_dismiss_personal_solo_banner';

export default function PersonalLinkedFromSoloBanner({ profileId }) {
  const [dismissed, setDismissed] = useState(() => {
    if (!profileId || typeof sessionStorage === 'undefined') return false;
    try {
      return sessionStorage.getItem(`${DISMISS_KEY}_${profileId}`) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(`${DISMISS_KEY}_${profileId}`, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      style={{
        marginBottom: spacing[12],
        padding: spacing[14],
        borderRadius: radii.card,
        border: `1px solid ${colors.primary}44`,
        background: colors.primarySubtle,
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          top: spacing[8],
          right: spacing[8],
          minWidth: touchTargetMin - 8,
          minHeight: touchTargetMin - 8,
          border: 'none',
          background: 'transparent',
          color: colors.muted,
          cursor: 'pointer',
        }}
      >
        <X size={18} />
      </button>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={14} />
        {personalCoachTransitionCopy.activeClientBannerTitle}
      </p>
      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.5, paddingRight: spacing[24] }}>
        {personalCoachTransitionCopy.activeClientBannerBody}
      </p>
      <Link
        to="/personal/coach-transition"
        style={{
          display: 'inline-block',
          marginTop: spacing[10],
          fontSize: 13,
          fontWeight: 600,
          color: colors.primary,
        }}
      >
        How this transition works
      </Link>
    </div>
  );
}
