import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ShieldCheck, ArrowRight } from 'lucide-react';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import { personalColumnInnerBodyStyle } from '@/lib/personalShellLayout';
import MarketplaceSoloVsCoachCompare from '@/components/marketplace/MarketplaceSoloVsCoachCompare';
import EscalationCallout from '@/components/coaching/EscalationCallout';
import { CoachHubState, derivePersonalCoachHubState, resolveMarketplaceTierFromProfile } from '@/lib/marketplaceScreenState';
import { atlasMigrationDataAttributes, derivePersonalCoachHubRouteState } from '@/lib/atlasMigrationPhases';
import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';
import { useAuth } from '@/lib/AuthContext';
import { usePresentationMode } from '@/lib/presentationMode';

export default function PersonalCoachTransitionPage() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { isWideWeb } = usePresentationMode();

  useEffect(() => {
    track(ANALYTICS_EVENTS.COACHING_HUB_OPENED, { source: 'personal_more' });
  }, []);

  const coachFitLines = useMemo(() => {
    const g = String(profile?.goal || profile?.personal_goal || '').toLowerCase();
    const lines = [
      'Use coach type, location, and transformation / competition filters to narrow the list.',
    ];
    if (g.includes('prep') || g.includes('comp') || g.includes('stage')) {
      lines.push('For prep: confirm they take stage clients and align on check-in cadence.');
    } else if (g.includes('fat') || g.includes('cut') || g.includes('lean')) {
      lines.push('For fat loss: favour coaches who stress adherence and sustainable deficits.');
    } else if (g.includes('muscle') || g.includes('bulk') || g.includes('hypertrophy')) {
      lines.push('For muscle gain: look for volume and recovery judgement, not just templates.');
    } else {
      lines.push('Pick a feedback style that fits you — high-touch messaging vs structured weekly reviews.');
    }
    return lines;
  }, [profile?.goal, profile?.personal_goal]);
  const coachHubState = useMemo(
    () => derivePersonalCoachHubState({ goal: profile?.goal || profile?.personal_goal || '' }),
    [profile?.goal, profile?.personal_goal]
  );
  const personalMarketplaceTier = useMemo(
    () => resolveMarketplaceTierFromProfile(profile, user),
    [profile, user]
  );
  const primaryCoachCta = useMemo(() => {
    if (coachHubState.key === CoachHubState.READY_TO_CONTACT) {
      return { label: 'Find prep-capable coaches', path: `/personal/coach-tier-selection?source=from_prep&tier=${encodeURIComponent(personalMarketplaceTier)}` };
    }
    if (coachHubState.key === CoachHubState.CONSIDER) {
      return { label: 'Compare coaches now', path: `/personal/coach-tier-selection?source=from_goal_urgency&tier=${encodeURIComponent(personalMarketplaceTier)}` };
    }
    return { label: 'Browse coach marketplace', path: `/personal/coach-tier-selection?source=from_general_discovery&tier=${encodeURIComponent(personalMarketplaceTier)}` };
  }, [coachHubState.key, personalMarketplaceTier]);

  const coachHubMigration = useMemo(
    () => derivePersonalCoachHubRouteState({ hubKey: coachHubState.key }),
    [coachHubState.key],
  );

  return (
    <PersonalCanvas>
      <div style={{ minHeight: '100%', color: colors.text }}>
        <TopBar title="Work with a coach" onBack={() => navigate(-1)} />
        <PersonalColumn variant="narrow">
          <div
            style={personalColumnInnerBodyStyle()}
            {...atlasMigrationDataAttributes(coachHubMigration.phase, coachHubMigration.primary)}
          >
            <Card
              style={{
                ...standardCard,
                padding: spacing[14],
                marginBottom: spacing[12],
                border: `1px solid rgba(255,255,255,0.12)`,
                background: colors.surface2,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.5, fontWeight: 600 }}>
                Personal helps you track and stay structured. A coach helps you actually get there faster.
              </p>
            </Card>

            <p style={{ margin: `0 0 ${spacing[16]}px`, fontSize: 15, color: colors.muted, lineHeight: 1.5 }}>
              You can keep solo guidance for structure and logging — add coaching when you want hands-on decisions,
              accountability, and deeper refinement.
            </p>

            <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[12] }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[10] }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.sm,
                    background: colors.surface2,
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                    Why people switch
                  </p>
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 14, color: colors.text, lineHeight: 1.45 }}>
                    Accountability, faster course correction, clearer decisions under fatigue, and prep-level precision
                    that solo tools should not pretend to replace.
                  </p>
                </div>
              </div>
            </Card>

            <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                When coaching helps most
              </p>
              <div style={{ marginTop: spacing[10] }}>
                <ul style={{ margin: 0, paddingLeft: 18, color: colors.muted, fontSize: 14, lineHeight: 1.55 }}>
                  {[
                    'Plateaus despite consistent logging',
                    'Prep or stage-focused timelines',
                    'Start-stop adherence patterns',
                    'Macro and fueling confusion week to week',
                    'Repeated low readiness or recovery judgement calls',
                  ].map((t) => (
                    <li key={t} style={{ marginBottom: spacing[6] }}>{t}</li>
                  ))}
                </ul>
              </div>
            </Card>

            <div style={{ marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                Personal vs coaching
              </p>
              <div style={{ marginTop: spacing[10] }}>
                <MarketplaceSoloVsCoachCompare isWideWeb={isWideWeb} />
              </div>
              <div style={{ marginTop: spacing[10] }}>
                <EscalationCallout text="This usually benefits from hands-on coaching when solo structure stops moving the needle." />
              </div>
            </div>

            <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                Best coach fit for your goal
              </p>
              <ul style={{ margin: `${spacing[10]}px 0 0`, paddingLeft: 18, color: colors.muted, fontSize: 14, lineHeight: 1.55 }}>
                {coachFitLines.map((t) => (
                  <li key={t} style={{ marginBottom: spacing[6] }}>{t}</li>
                ))}
              </ul>
            </Card>

            <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                Browse marketplace
              </p>
              <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                Open listings, read how they coach, then message in one tap — no commitment. Your log stays on Atlas either way.
              </p>
              <button
                type="button"
                onClick={() => navigate(primaryCoachCta.path)}
                style={{
                  marginTop: spacing[10],
                  width: '100%',
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  color: colors.text,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Users size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {primaryCoachCta.label}
                <ArrowRight size={16} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/enter-invite-code')}
                style={{
                  marginTop: spacing[8],
                  width: '100%',
                  minHeight: touchTargetMin - 2,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  color: colors.muted,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Enter invite code
              </button>
            </Card>
          </div>
        </PersonalColumn>
      </div>
    </PersonalCanvas>
  );
}
