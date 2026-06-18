import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import PressableCard from '@/components/PressableCard';
import { colors, spacing, shadows } from '@/ui/tokens';
import { sectionLabel, sectionGap } from '@/ui/pageLayout';
import { hapticNavigation } from '@/lib/haptics';
import { getPrimaryCtaForWorkloadItem } from '@/lib/coachWorkloadEngine';
import CoachDailyPriorityStrip from '@/components/coach/CoachDailyPriorityStrip';
import { coachDailyStripToReviewQueuePath, getCoachWorkloadNavigatePath, coachQueueClientSegmentLabel } from '@/lib/coachDailyWorkflowModel';
import { REVIEW_NEXT_PATH, buildReviewQueueUrl } from '@/lib/coachReviewRoutes';
import ContextScreenHeader from '@/components/daily-command-center/ContextScreenHeader';
import PrimaryActionCard from '@/components/daily-command-center/PrimaryActionCard';
import SupportInsightCard from '@/components/daily-command-center/SupportInsightCard';
import { ClipboardCheck, ListChecks, FileText, UserPlus, UtensilsCrossed, Crosshair, Layers, Copy } from 'lucide-react';
import { getNativePref } from '@/lib/nativePreferences';

const COACH_STRIP_PREF_KEY = 'atlas_pref_coach_strip_key';

/** Today strip + welcome + primary action queue + feed + desktop sidebar. */
export default function CoachActionQueue(props) {
  const navigate = useNavigate();
  const {
    todayFocusHeader,
    coachStripKey,
    setCoachStripKey,
    coachStripCounts,
    isDesktopWeb,
    coachHasNoClients,
    showPoseAndPeak,
    cardStyle,
    workloadQueue,
    priorityFeedItems,
    unreadThreads,
    clientsAtRiskToday,
    clientJourneyById,
    coachingSignupLink,
    copyCoachingLinkStartHere,
    startHereInviteCode,
    startHereCodeLoading,
  } = props;

  React.useEffect(() => {
    let cancelled = false;
    getNativePref(COACH_STRIP_PREF_KEY, null).then((pref) => {
      if (cancelled) return;
      if (typeof pref === 'string' && pref && pref !== coachStripKey) {
        setCoachStripKey(pref);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coachStripKey, setCoachStripKey]);

  return (
        <section style={{ marginBottom: sectionGap }}>
          <ContextScreenHeader
            title={todayFocusHeader.title}
            subtitle={todayFocusHeader.subtitle}
          />
          <div style={{ marginTop: spacing[12] }}>
            <CoachDailyPriorityStrip
              selectedKey={coachStripKey}
              counts={coachStripCounts}
              onSelect={setCoachStripKey}
              compact={!isDesktopWeb}
            />
          </div>

          {!isDesktopWeb && !coachHasNoClients ? (
            <div
              className={showPoseAndPeak ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}
              style={{ marginTop: spacing[14] }}
              role="navigation"
              aria-label="Primary shortcuts"
            >
              <PressableCard
                className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticNavigation(); navigate('/review-center'); }}
              >
                <ListChecks size={20} style={{ color: colors.primary }} aria-hidden />
                <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Review Queue</span>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticNavigation(); navigate('/get-clients'); }}
              >
                <UserPlus size={20} style={{ color: colors.primary }} aria-hidden />
                <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Get Clients</span>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticNavigation(); navigate('/programs'); }}
              >
                <FileText size={20} style={{ color: colors.primary }} aria-hidden />
                <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Programs</span>
              </PressableCard>
              {showPoseAndPeak ? (
                <PressableCard
                  className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticNavigation(); navigate('/comp-prep'); }}
                >
                  <Crosshair size={20} style={{ color: colors.primary }} aria-hidden />
                  <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Comp Prep</span>
                </PressableCard>
              ) : null}
            </div>
          ) : null}

          {coachHasNoClients ? (
            <Card
              style={{
                ...cardStyle,
                padding: spacing[16],
                marginTop: spacing[16],
                marginBottom: spacing[16],
                border: `1px solid ${colors.primary}44`,
                background: `linear-gradient(160deg, ${colors.primarySubtle} 0%, ${colors.surface1} 55%)`,
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: colors.accent, letterSpacing: '0.08em' }}
              >
                Start here
              </p>
              <h2 className="text-lg font-semibold leading-snug" style={{ color: colors.text }}>
                Welcome — open for business in three moves
              </h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: colors.muted }}>
                Share your link, then build what you deliver. Assign programs from Clients or Program assignments once someone joins.
              </p>

              <div
                className="rounded-xl mt-4 p-3"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              >
                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: colors.muted, letterSpacing: '0.06em' }}>
                  Your coaching link
                </p>
                {coachingSignupLink ? (
                  <>
                    <p className="text-xs font-mono break-all mb-3 leading-relaxed" style={{ color: colors.text }}>
                      {coachingSignupLink}
                    </p>
                    <Button
                      type="button"
                      className="w-full font-semibold gap-2"
                      style={{ background: colors.primary, color: '#fff' }}
                      onClick={copyCoachingLinkStartHere}
                    >
                      <Copy size={16} strokeWidth={2} aria-hidden />
                      Copy coaching link
                    </Button>
                    {!startHereInviteCode ? (
                      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: colors.muted }}>
                        Your code is generating. Use your link for now.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: colors.muted }}>
                    {startHereCodeLoading ? 'Loading link…' : 'Sign in as a coach to get your coaching link.'}
                  </p>
                )}
              </div>

              <p className="text-[11px] font-semibold uppercase mt-4 mb-2" style={{ color: colors.muted, letterSpacing: '0.06em' }}>
                Top actions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <PressableCard
                  className="rounded-xl p-3 text-left min-h-[72px] flex flex-col justify-center gap-1"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticNavigation(); navigate('/get-clients'); }}
                >
                  <UserPlus size={18} className="shrink-0" style={{ color: colors.primary }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>Add first client</span>
                  <span className="text-[11px] leading-tight" style={{ color: colors.muted }}>Invite code or link</span>
                </PressableCard>
                <PressableCard
                  className="rounded-xl p-3 text-left min-h-[72px] flex flex-col justify-center gap-1"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticNavigation(); navigate('/program-builder'); }}
                >
                  <Layers size={18} className="shrink-0" style={{ color: colors.primary }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>Create first program</span>
                  <span className="text-[11px] leading-tight" style={{ color: colors.muted }}>Program Builder</span>
                </PressableCard>
                <PressableCard
                  className="rounded-xl p-3 text-left min-h-[72px] flex flex-col justify-center gap-1 col-span-1 sm:col-span-2"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticNavigation(); navigate('/nutrition-builder'); }}
                >
                  <UtensilsCrossed size={18} className="shrink-0" style={{ color: colors.primary }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>Create first nutrition plan</span>
                  <span className="text-[11px] leading-tight" style={{ color: colors.muted }}>Targets &amp; meals for clients</span>
                </PressableCard>
              </div>
            </Card>
          ) : null}

          <div
            className={isDesktopWeb ? 'grid grid-cols-1 lg:grid-cols-12 gap-5' : ''}
            style={{ marginTop: spacing[12] }}
          >
            <div className={isDesktopWeb ? 'lg:col-span-8 min-w-0' : 'min-w-0'}>
              <div
                style={{
                  borderRadius: 16,
                  border: `1px solid ${colors.primary}55`,
                  background: `linear-gradient(165deg, rgba(59,130,246,0.1) 0%, ${colors.surface1} 50%)`,
                  padding: spacing[14],
                  marginBottom: spacing[14],
                  boxShadow: shadows.cardShadow,
                }}
              >
                <PrimaryActionCard
                  title="Action queue"
                  body={
                    workloadQueue.length > 0
                      ? `${workloadQueue.length} open action${workloadQueue.length === 1 ? '' : 's'} across your roster.${
                          coachStripKey !== 'all'
                            ? ` Showing ${priorityFeedItems.length} for this filter.`
                            : ''
                        }`
                      : 'Nothing needs your attention right now.\nInvite clients or request check-ins to start your workflow.'
                  }
                  primaryAction={{
                    label: coachStripKey === 'all' ? 'Open Review Queue' : 'Open filtered queue',
                    onClick: () => navigate(coachDailyStripToReviewQueuePath(coachStripKey)),
                  }}
                  secondaryActions={
                    isDesktopWeb
                      ? [
                          { label: 'Review next', onClick: () => { hapticNavigation(); navigate(REVIEW_NEXT_PATH); } },
                          { label: 'Messages', onClick: () => { hapticNavigation(); navigate('/messages'); } },
                        ]
                      : [{ label: 'Review next', onClick: () => { hapticNavigation(); navigate(REVIEW_NEXT_PATH); } }]
                  }
                  icon={ClipboardCheck}
                />
                {isDesktopWeb ? (
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full font-semibold min-h-[44px] text-[13px]"
                      onClick={() => { hapticNavigation(); navigate('/get-clients'); }}
                    >
                      <UserPlus size={16} className="inline mr-2" />
                      Get Clients
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full font-semibold min-h-[44px] text-[13px]"
                      onClick={() => { hapticNavigation(); navigate(buildReviewQueueUrl({ filter: 'checkins' })); }}
                    >
                      <ClipboardCheck size={16} className="inline mr-2" />
                      Check-in queue
                    </Button>
                  </div>
                ) : null}
              </div>
              {isDesktopWeb ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ marginTop: spacing[10] }}>
                  <SupportInsightCard
                    eyebrow="Messages"
                    title={`${unreadThreads.length} unread`}
                    body="Client threads waiting."
                    action={{ label: 'Open inbox', onClick: () => navigate('/messages') }}
                  />
                  <SupportInsightCard
                    eyebrow="At risk"
                    title={`${clientsAtRiskToday.length} flagged`}
                    body="Retention signals on your roster."
                    action={{ label: 'View at-risk queue', onClick: () => navigate(buildReviewQueueUrl({ filter: 'at_risk' })) }}
                  />
                </div>
              ) : null}
              <div style={{ marginTop: spacing[12] }}>
                <div style={{ marginBottom: spacing[8] }}>
                  <span style={sectionLabel}>Action queue</span>
                </div>
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  {priorityFeedItems.length === 0 ? (
                    <div className="space-y-3">
                      {coachStripKey === 'all' ? (
                        <>
                          <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                            Nothing needs your attention right now
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                            Invite clients or request check-ins to start your workflow
                          </p>
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                          Nothing in this filter right now. Try another priority or open Review Center.
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 font-semibold min-h-[42px] text-[13px]"
                          onClick={() => { hapticNavigation(); navigate('/get-clients'); }}
                        >
                          Invite clients
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 font-semibold min-h-[42px] text-[13px]"
                          onClick={() => { hapticNavigation(); navigate(buildReviewQueueUrl({ filter: 'checkins' })); }}
                        >
                          Request check-in
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ul className="space-y-0">
                      {priorityFeedItems.map((item, idx) => {
                        const cta = getPrimaryCtaForWorkloadItem(item);
                        const segment = coachQueueClientSegmentLabel(item.client_id, clientJourneyById);
                        const urgency = String(item.priority_label || 'soon');
                        return (
                          <li key={`${item.client_id || 'global'}-pf-${idx}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <div className="py-3 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                                  {item.client_name || 'Client'}
                                  <span className="font-normal text-xs ml-1.5" style={{ color: colors.muted }}>
                                    · {segment}
                                  </span>
                                </p>
                                <p className="text-xs truncate mt-0.5" style={{ color: colors.muted }}>
                                  {item.reason_summary || 'Needs attention'}
                                  <span className="ml-1.5 capitalize">· {urgency}</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  hapticNavigation();
                                  navigate(getCoachWorkloadNavigatePath(item));
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5 shrink-0"
                                style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                              >
                                {cta}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
            {isDesktopWeb ? (
              <aside className="lg:col-span-4 min-w-0 space-y-2" aria-label="Today sidebar">
                <SupportInsightCard
                  eyebrow="Messages"
                  title={`${unreadThreads.length} unread`}
                  body="Client threads waiting."
                  action={{ label: 'Open inbox', onClick: () => navigate('/messages') }}
                />
                <SupportInsightCard
                  eyebrow="At risk"
                  title={`${clientsAtRiskToday.length} flagged`}
                  body="Retention signals on your roster."
                  action={{ label: 'View at-risk queue', onClick: () => navigate(buildReviewQueueUrl({ filter: 'at_risk' })) }}
                />
              </aside>
            ) : null}
          </div>
        </section>
  );
}
