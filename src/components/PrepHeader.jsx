/**
 * Prep header for clients with an active contest prep: weeks/days out, peak week badge, pose check status, quick actions.
 * Integrates Peak Week engine: active status, days out, check-in due today; Open Peak Week, Set Up Peak Week, Review Peak Check-In.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getPrepInsightSummaries } from '@/lib/prepInsights';
import { generatePrepInsight } from '@/lib/atlasInsights';
import InsightCard from '@/components/review/InsightCard';
import { Calendar, ImageIcon, Zap, ClipboardList } from 'lucide-react';

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

/** Fetch active peak_week for client and whether a peak week check-in is due today. */
async function fetchPeakWeekStatus(clientId) {
  if (!hasSupabase || !clientId) return { peakWeek: null, checkInDueToday: false };
  const supabase = getSupabase();
  if (!supabase) return { peakWeek: null, checkInDueToday: false };
  try {
    const { data: week } = await supabase
      .from('peak_weeks')
      .select('id, show_date')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('show_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!week) return { peakWeek: null, checkInDueToday: false };
    const showDate = week.show_date ? new Date(week.show_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toISODate(today);
    let daysOut = null;
    if (showDate) {
      showDate.setHours(0, 0, 0, 0);
      daysOut = Math.ceil((showDate - today) / (24 * 60 * 60 * 1000));
    }
    const inPeakWindow = daysOut != null && daysOut >= -7 && daysOut <= 0;
    let checkInDueToday = false;
    if (inPeakWindow) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toISODate(tomorrow);
      const { data: checkinsToday } = await supabase
        .from('peak_week_checkins')
        .select('id')
        .eq('peak_week_id', week.id)
        .gte('created_at', `${todayStr}T00:00:00`)
        .lt('created_at', `${tomorrowStr}T00:00:00`)
        .limit(1);
      checkInDueToday = !(checkinsToday && checkinsToday.length > 0);
    }
    return { peakWeek: { ...week, days_out: daysOut }, checkInDueToday };
  } catch (_) {
    return { peakWeek: null, checkInDueToday: false };
  }
}

async function fetchPrepHeader(clientId) {
  if (!hasSupabase || !clientId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('v_client_prep_header')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (_) {
    return null;
  }
}

async function fetchPrepHeaderWithInsights(clientId) {
  if (!hasSupabase || !clientId) return { header: null, metrics: null, poseChecksLast4w: 0 };
  const supabase = getSupabase();
  if (!supabase) return { header: null, metrics: null, poseChecksLast4w: 0 };
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  try {
    const [headerRes, metricsRes, poseRes] = await Promise.all([
      supabase.from('v_client_prep_header').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('v_client_progress_metrics').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('pose_checks').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('submitted_at', fourWeeksAgo.toISOString()),
    ]);
    return {
      header: headerRes.data ?? null,
      metrics: metricsRes.data ?? null,
      poseChecksLast4w: poseRes.count ?? 0,
    };
  } catch (_) {
    return { header: null, metrics: null, poseChecksLast4w: 0 };
  }
}

export default function PrepHeader({ clientId, showPrepInsights = false }) {
  const navigate = useNavigate();
  const { effectiveRole } = useAuth();
  const [prep, setPrep] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [peakWeekStatus, setPeakWeekStatus] = useState({ peakWeek: null, checkInDueToday: false });
  const [loading, setLoading] = useState(true);

  const isCoachRole = isCoach(effectiveRole);

  useEffect(() => {
    if (!clientId) {
      setPrep(null);
      setInsightsData(null);
      setPeakWeekStatus({ peakWeek: null, checkInDueToday: false });
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (showPrepInsights) {
      Promise.all([fetchPrepHeaderWithInsights(clientId), fetchPeakWeekStatus(clientId)]).then(([out, pwStatus]) => {
        if (!cancelled) {
          setPrep(out.header);
          setInsightsData(out);
          setPeakWeekStatus(pwStatus);
          setLoading(false);
        }
      });
    } else {
      Promise.all([fetchPrepHeader(clientId), fetchPeakWeekStatus(clientId)]).then(([row, pwStatus]) => {
        if (!cancelled) {
          setPrep(row);
          setInsightsData(null);
          setPeakWeekStatus(pwStatus);
          setLoading(false);
        }
      });
    }
    return () => { cancelled = true; };
  }, [clientId, showPrepInsights]);

  if (loading || !prep) return null;

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
  const atlasPrepInsight = prepData ? generatePrepInsight(prepData) : null;
  const showAtlasPrep = atlasPrepInsight && atlasPrepInsight.title !== 'No active prep';

  const summaries = showPrepInsights && insightsData
    ? getPrepInsightSummaries(insightsData.header, insightsData.metrics, {
        poseChecksLast4w: insightsData.poseChecksLast4w,
        poseSubmittedThisWeek: prep.pose_check_submitted_this_week === true,
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
