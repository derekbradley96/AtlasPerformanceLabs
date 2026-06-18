import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import CoachCard from '@/components/marketplace/CoachCard';
import { mapDiscoveryRowToCoachCardData } from '@/lib/marketplaceCoachCardModel';
import { PERSONAL_MARKETPLACE_SOURCE } from '@/lib/personalMarketplaceEntry';
import { colors, shell } from '@/ui/tokens';
import { cardRhythm, space } from '@/ui/rhythm';

function resolveMarketplaceSlugFromPreviewRow(row) {
  if (!row || typeof row !== 'object') return '';
  const rawSlug = row.slug != null ? String(row.slug).trim() : '';
  if (rawSlug && rawSlug !== 'preview') return rawSlug;
  const ref = row.referral_code != null ? String(row.referral_code).trim() : '';
  return ref || '';
}

/**
 * Live-ish marketplace tile preview for coaches editing their listing.
 */
export default function CoachMarketplaceListingPreview({ previewRow, strength, isWideWeb = false }) {
  const navigate = useNavigate();
  const cardData = mapDiscoveryRowToCoachCardData(previewRow, {
    entrySource: PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY,
    userGoal: '',
    isPersonal: false,
  });

  const onViewProfile = useCallback(() => {
    const slug = resolveMarketplaceSlugFromPreviewRow(previewRow);
    if (!slug) {
      toast.message('Add a profile URL (slug) on your listing, or ensure your invite code is set, to open the full profile.');
      return;
    }
    navigate(`/marketplace/coach/${encodeURIComponent(slug)}`);
  }, [navigate, previewRow]);

  const missing = strength?.missingHints?.length
    ? `Missing: ${strength.missingHints.slice(0, 4).join(' · ')}`
    : null;
  const weak = strength?.weakHints?.length ? strength.weakHints[0] : null;

  return (
    <div
      style={{
        padding: cardRhythm.standard.padding,
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        background: colors.surface1,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
        Discovery preview
      </p>
      <p className="text-xs mt-1 mb-3" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
        Approximate card athletes see in Find a coach. Match badges only apply when their journey aligns with yours.
      </p>
      <div style={{ opacity: 0.98 }}>
        <CoachCard
          coachId={String(cardData.coachId || 'preview')}
          variant={cardData.variant}
          showBestMatchBadge={false}
          coachName={cardData.coachName}
          coachHeadline={cardData.coachHeadline}
          coachAvatarUrl={cardData.coachAvatarUrl}
          tags={cardData.tags}
          matchReason={null}
          trustItems={cardData.trustItems}
          pricingDisplay={cardData.pricingDisplay}
          pricingMode={cardData.pricingMode}
          actionState={cardData.actionState}
          isWideWeb={isWideWeb}
          showSave={false}
          showMessage={false}
          onViewProfile={onViewProfile}
        />
      </div>
      {(missing || weak) && (
        <div className="text-xs space-y-1" style={{ marginTop: space[4], color: colors.muted, lineHeight: 1.45 }}>
          {missing ? <p style={{ margin: 0 }}>{missing}</p> : null}
          {weak ? <p style={{ margin: 0, color: colors.textSecondary }}>Tip: {weak}</p> : null}
        </div>
      )}
    </div>
  );
}
