/**
 * Prep header for clients with an active contest prep: weeks/days out, peak week badge, pose check status, quick actions.
 * Integrates Peak Week engine: active status, days out, check-in due today; Open Peak Week, Set Up Peak Week, Review Peak Check-In.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { resolveViewerBodyweightUnit } from '@/lib/bodyMeasurementUnits';
import { isCoach } from '@/lib/roles';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getPrepInsightSummaries } from '@/lib/prepInsights';
import { generatePrepInsight } from '@/lib/atlasInsights';
import InsightCard from '@/components/review/InsightCard';
import { Calendar, ImageIcon, Zap, ClipboardList } from 'lucide-react';
import { fetchPrepHeaderBundle } from '@/data/prepHeaderQueries';

export default function PrepHeader({ clientId, showPrepInsights = false }) {
  const navigate = useNavigate();
  const { effectiveRole, profile } = useAuth();
  const viewerWU = resolveViewerBodyweightUnit(profile);

  const { data, isLoading } = useQuery({
    queryKey: ['prep-header', clientId, showPrepInsights],
    queryFn: () => fetchPrepHeaderBundle(clientId, showPrepInsights),
    enabled: Boolean(clientId),
  });

  const prep = data?.prep ?? null;
  const insightsData = data?.insightsData ?? null;
  const peakWeekStatus = data?.peakWeekStatus ?? { peakWeek: null, checkInDueToday: false };

  const isCoachRole = isCoach(effectiveRole);

  if (!clientId) return null;

  if (isLoading) {
    return (
      <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
        <div className="animate-pulse space-y-3" aria-hidden="true">
          <div className="h-3 rounded" style={{ width: '32%', background: colors.surface2 }} />
          <div className="h-5 rounded-lg" style={{ width: '58%', background: colors.surface2 }} />
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="h-9 rounded-lg" style={{ width: 120, background: colors.surface2 }} />
            <div className="h-9 rounded-lg" style={{ width: 140, background: colors.surface2 }} />
          </div>
        </div>
        <span className="sr-only">Loading contest prep summary</span>
      </Card>
    );
  }

  if (!prep) return null;

  const weeksOut = prep.weeks_out != null ? Number(prep.weeks_out) : null;
  const daysOut = prep.days_out != null ? Number(prep.days_out) : null;
  const isPeakWeek = prep.is_peak_week === true;
  const poseSubmitted = prep.pose_check_submitted_this_week === true;
  const showDate = prep.show_date ? new Date(prep.show_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
  const showPassed = daysOut != null && daysOut < 0;

  const prepData = prep ? {
    has_active_prep: true,
    days_out: prep.days_out ?? insightsData?.metrics?.days_out,
    show_date: prep.show_date,
    pose_check_submitted_this_week: prep.pose_check_submitted_this_week === true,
    weight_change: insightsData?.metrics?.weight_change,
    show_name: prep.show_name,
    division: prep.division,
  } : null;
  const atlasPrepInsight = prepData ? generatePrepInsight(prepData, viewerWU) : null;
  const showAtlasPrep = atlasPrepInsight && atlasPrepInsight.title !== 'No active prep';

  const summaries = showPrepInsights && insightsData
    ? getPrepInsightSummaries(insightsData.header, insightsData.metrics, {
        poseChecksLast4w: insightsData.poseChecksLast4w,
        poseSubmittedThisWeek: prep.pose_check_submitted_this_week === true,
        viewerWeightUnit: viewerWU,
      })
    : [];

  return (
    <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: colors.muted }}>
        <Calendar size={16} />
        <span className="text-xs font-medium">Contest prep</span>
        {showDate && (
          <span className="text-xs">· {showDate}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium" style={{ color: colors.text }}>
          {showPassed ? 'Show passed' : null}
          {!showPassed && weeksOut != null && weeksOut >= 0 && `${weeksOut} weeks out`}
          {!showPassed && weeksOut != null && weeksOut >= 0 && daysOut != null && ' · '}
          {!showPassed && daysOut != null && daysOut >= 0 && `${daysOut} days out`}
        </span>
        {isPeakWeek && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: colors.primary, color: '#fff' }}
          >
            <Zap size={12} /> Peak week
          </span>
        )}
        <span className="text-xs" style={{ color: colors.muted }}>
          Pose check: {poseSubmitted ? 'Submitted' : 'Due'}
        </span>
        {peakWeekStatus.peakWeek && (
          <>
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: colors.surface2, color: colors.text }}>
              Peak week active
              {peakWeekStatus.peakWeek.days_out != null && ` · ${peakWeekStatus.peakWeek.days_out} days out`}
            </span>
            {peakWeekStatus.checkInDueToday && (
              <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: colors.warningSubtle, color: colors.warning }}>
                Check-in due today
              </span>
            )}
          </>
        )}
      </div>
      {(showAtlasPrep || summaries.length > 0) && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Prep insights</p>
          {showAtlasPrep && (
            <InsightCard
              level={atlasPrepInsight.level === 'warning' ? 'warning' : atlasPrepInsight.level === 'positive' ? 'positive' : 'neutral'}
              title={atlasPrepInsight.title}
              detail={atlasPrepInsight.summary}
            />
          )}
          {summaries.map((s, i) => (
            <InsightCard key={i} level={s.level} title={s.title} detail={s.detail} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {isCoachRole && (
          <>
            {peakWeekStatus.peakWeek ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${clientId}/peak-week-editor`)}>
                Open Peak Week
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${clientId}/peak-week-editor`)}>
                Set Up Peak Week
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/review-center/peak-week-checkins')}>
              <ClipboardList size={14} className="mr-1.5" />
              Review Peak Check-In
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${clientId}/pose-timeline`)}>
              Pose Timeline
            </Button>
          </>
        )}
        {!isCoachRole && !poseSubmitted && (
          <Button variant="outline" size="sm" onClick={() => navigate('/pose-check')}>
            <ImageIcon size={14} className="mr-1.5" />
            Submit Pose Check
          </Button>
        )}
        {!isCoachRole && peakWeekStatus.peakWeek && (
          <Button variant="outline" size="sm" onClick={() => navigate('/peak-week-checkin')}>
            <ClipboardList size={14} className="mr-1.5" />
            Peak Week Check-In
          </Button>
        )}
      </div>
    </Card>
  );
}
