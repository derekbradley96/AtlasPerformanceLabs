import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import { personalColumnInnerBodyStyle } from '@/lib/personalShellLayout';
import {
  buildDiscoverUrl,
  normalizeMarketplaceTier,
  resolveMarketplaceTierFromProfile,
} from '@/lib/marketplaceScreenState';
import { atlasMigrationDataAttributes, derivePersonalCoachTierSelectionState } from '@/lib/atlasMigrationPhases';
import { useAuth } from '@/lib/AuthContext';
import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';

const TIER_OPTIONS = [
  {
    id: 'basic',
    title: 'Personal',
    body: 'Structured solo tracking and straightforward coach matching.',
  },
];

export default function PersonalCoachTierSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const source = String(searchParams.get('source') || 'from_general_discovery');
  const tierHintRaw = searchParams.get('tier');
  const tierHint =
    tierHintRaw != null && String(tierHintRaw).trim() !== ''
      ? normalizeMarketplaceTier(tierHintRaw)
      : null;
  const currentTier = resolveMarketplaceTierFromProfile(profile, user);
  const [selectedTier, setSelectedTier] = useState(() => tierHint ?? currentTier);
  const tierSelectionMigration = useMemo(
    () => derivePersonalCoachTierSelectionState({ tier: normalizeMarketplaceTier(selectedTier) }),
    [selectedTier],
  );

  const continueToDiscover = () => {
    const tier = normalizeMarketplaceTier(selectedTier);
    track(ANALYTICS_EVENTS.PERSONAL_COACH_TIER_SELECTED, {
      tier,
      source,
      previous_tier: normalizeMarketplaceTier(currentTier),
    }).catch(() => {});
    navigate(buildDiscoverUrl({ source, tier }));
  };

  return (
    <PersonalCanvas>
      <div style={{ minHeight: '100%', color: colors.text }}>
        <TopBar title="Choose coach matching level" onBack={() => navigate(-1)} />
        <PersonalColumn variant="narrow">
          <div
            style={personalColumnInnerBodyStyle()}
            {...atlasMigrationDataAttributes(tierSelectionMigration.phase, tierSelectionMigration.primary)}
          >
            <Card style={{ padding: spacing[14], marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                Conversion setup
              </p>
              <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
                Pick the matching level for this coach search. You can change this later.
              </p>
            </Card>

            <div style={{ display: 'grid', gap: spacing[10], marginBottom: spacing[12] }}>
              {TIER_OPTIONS.map((t) => {
                const active = selectedTier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTier(t.id)}
                    style={{
                      textAlign: 'left',
                      width: '100%',
                      borderRadius: radii.md,
                      border: `1px solid ${active ? colors.primary : colors.border}`,
                      background: active ? colors.primarySubtle : colors.surface1,
                      color: colors.text,
                      padding: spacing[14],
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: spacing[6] }}>
                      {t.id === 'enhanced' ? <Sparkles size={16} color={colors.primary} /> : <ShieldCheck size={16} color={colors.primary} />}
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>{t.body}</p>
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              onClick={continueToDiscover}
              style={{ width: '100%', minHeight: touchTargetMin + 4 }}
            >
              Continue to coach discovery
            </Button>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45, textAlign: 'center' }}>
              Next: open a coach profile, then tap Join this coach to send your intro.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/enterinvitecode?tier=${encodeURIComponent(selectedTier)}`)}
              style={{ width: '100%', marginTop: spacing[8], minHeight: touchTargetMin }}
            >
              I already have an invite code
            </Button>
          </div>
        </PersonalColumn>
      </div>
    </PersonalCanvas>
  );
}

