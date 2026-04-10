import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, KeyRound } from 'lucide-react';
import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';
import { colors, radii, spacing, touchTargetMin } from '@/ui/tokens';
import { PERSONAL_MARKETPLACE_SOURCE, normalizePersonalMarketplaceSource } from '@/lib/personalMarketplaceEntry';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';

/**
 * @param {{ marketplaceSource?: string }} props — canonical `from_*` source for discover hero + analytics.
 */
export default function FindCoachCTA({ marketplaceSource = PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY } = {}) {
  const navigate = useNavigate();
  const src = normalizePersonalMarketplaceSource(marketplaceSource);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[8] }}>
      <button
        type="button"
        onClick={() => {
          navigate(buildPersonalCoachTierSelectionUrl({ source: src }));
        }}
        style={{ minHeight: touchTargetMin + 2, borderRadius: radii.button, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
      >
        <Users size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        Browse coaches
      </button>
      <button
        type="button"
        onClick={() => {
          track(ANALYTICS_EVENTS.INVITE_CODE_OPENED_FROM_PERSONAL, { source: 'coaching_hub' }).catch(() => {});
          navigate('/enterinvitecode');
        }}
        style={{ minHeight: touchTargetMin + 2, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, fontWeight: 600, cursor: 'pointer' }}
      >
        <KeyRound size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        Enter invite code
      </button>
    </div>
  );
}
