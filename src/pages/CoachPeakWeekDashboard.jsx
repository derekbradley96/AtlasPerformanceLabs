/**
 * Coach Peak Week Dashboard – prep coaches manage athletes approaching show day.
 * Competition and integrated focus only; transformation shows not-available state.
 * Data: peak_weeks, clients, peak_week_checkins, stage_readiness_scores.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { PeakWeekDashboardSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { Calendar, MessageSquare, ClipboardList, Scale, Activity } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

function showPeakWeekByFocus(coachFocus) {
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

function daysOut(showDate) {
  if (!showDate) return null;
  const show = new Date(showDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  show.setHours(0, 0, 0, 0);
  return Math.ceil((show - today) / (24 * 60 * 60 * 1000));
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

/** Fetch active peak weeks for coach with client name, latest check-in, latest readiness. */
async function fetchPeakWeekDashboard(coachId) {
  if (!hasSupabase || !coachId) return { rows: [], checkinsByPeakWeek: {}, readinessByClient: {} };
  const supabase = getSupabase();
  if (!supabase) return { rows: [], checkinsByPeakWeek: {}, readinessByClient: {} };
  try {
    const { data: weeks, error: weeksErr } = await supabase
      .from('peak_weeks')
      .select('id, client_id, coach_id, contest_prep_id, show_date, division, created_at, is_active')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('show_date', { ascending: true });
    if (weeksErr || !Array.isArray(weeks) || weeks.length === 0) {
      return { rows: weeks || [], checkinsByPeakWeek: {}, readinessByClient: {} };
    }
    const peakWeekIds = weeks.map((w) => w.id);
    const clientIds = [...new Set(weeks.map((w) => w.client_id))];
    const { data: clients } = await supabase.from('clients').select('id, name, full_name').in('id', clientIds);
    const nameByClientId = {};
    (clients || []).forEach((c) => { nameByClientId[c.id] = c.name || c.full_name || 'Client'; });
    const { data: checkins } = await supabase
      .from('peak_week_checkins')
      .select('*')
      .in('peak_week_id', peakWeekIds)
      .order('created_at', { ascending: false });
    const latestCheckinByPeakWeek = {};
    (checkins || []).forEach((c) => {
      if (!latestCheckinByPeakWeek[c.peak_week_id]) latestCheckinByPeakWeek[c.peak_week_id] = c;
    });
    const { data: readiness } = await supabase
      .from('stage_readiness_scores')
      .select('*')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false });
    const latestReadinessByClient = {};
    (readiness || []).forEach((r) => {
      if (!latestReadinessByClient[r.client_id]) latestReadinessByClient[r.client_id] = r;
    });
    const rows = weeks.map((w) => ({
      ...w,
      client_name: nameByClientId[w.client_id] || 'Client',
      days_out: daysOut(w.show_date),
      latest_checkin: latestCheckinByPeakWeek[w.id] ?? null,
      latest_readiness: latestReadinessByClient[w.client_id] ?? null,
    }));
    return { rows, checkinsByPeakWeek: latestCheckinByPeakWeek, readinessByClient: latestReadinessByClient };
  } catch (e) {
    if (import.meta.env?.DEV) console.error('[CoachPeakWeekDashboard] fetch error', e);
    throw e;
  }
}

export default function CoachPeakWeekDashboard() {
  const navigate = useNavigate();
  const { user, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPeakWeek = showPeakWeekByFocus(coachFocus);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState({ rows: [], checkinsByPeakWeek: {}, readinessByClient: {} });

  const coachId = user?.id ?? null;

  const refetch = React.useCallback(() => {
    setError(false);
    if (!coachId) return;
    setLoading(true);
    fetchPeakWeekDashboard(coachId)
      .then((out) => {
        setData(out ?? { rows: [], checkinsByPeakWeek: {}, readinessByClient: {} });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [coachId]);

  useEffect(() => {
    if (!coachId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchPeakWeekDashboard(coachId)
      .then((out) => {
        if (!cancelled) setData(out ?? { rows: [], checkinsByPeakWeek: {}, readinessByClient: {} });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [coachId]);

  const summary = useMemo(() => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = rows.length;
    const withinSeven = rows.filter((r) => r.days_out != null && r.days_out <= 7).length;
    const checkInsDueToday = rows.filter((r) => {
      const hasCheckinToday = r.latest_checkin && isToday(r.latest_checkin.created_at);
      return r.days_out != null && r.days_out <= 7 && !hasCheckinToday;
    }).length;
    const needingUpdate = rows.filter((r) => {
      if (r.days_out == null || r.days_out > 7) return false;
      const hasCheckinToday = r.latest_checkin && isToday(r.latest_checkin.created_at);
      const hasRecentReadiness = r.latest_readiness && isToday(r.latest_readiness.created_at);
      return !hasCheckinToday || !hasRecentReadiness;
    }).length;
    return { total, withinSeven, checkInsDueToday, needingUpdate };
  }, [data?.rows]);

  if (error && showPeakWeek) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
          <h1 className="atlas-page-title">Peak Week Dashboard</h1>
          <LoadErrorFallback
            title="Couldn't load peak week data"
            description="Check your connection and try again."
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  if (!showPeakWeek) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
          <h1 className="atlas-page-title">Peak Week Dashboard</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
            Only available when your coach focus is Competition or Integrated.
          </p>
          <Card style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
            <Calendar size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
            <p className="text-[15px] font-medium" style={{ color: colors.text }}>
              Peak Week Dashboard is for prep coaches
            </p>
            <p className="text-sm mt-1" style={{ color: colors.muted }}>
              Change your focus in Account or Coach type to Competition or Integrated to manage athletes approaching show day.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => { hapticLight(); navigate('/home'); }}>
              Back to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const cardStyle = { ...standardCard, padding: spacing[16] };

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <h1 className="atlas-page-title">Peak Week Dashboard</h1>
        <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
          Athletes approaching show day. Open peak week plan, review check-ins, message clients.
        </p>

        {loading ? (
          <PeakWeekDashboardSkeleton />
        ) : (
          <>
            {/* Summary */}
            <section style={{ marginBottom: sectionGap }}>
              <div style={sectionLabel}>Summary</div>
              <div className="grid grid-cols-2 gap-3">
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  <p className="text-xs font-medium" style={{ color: colors.muted }}>Active peak weeks</p>
                  <p className="text-xl font-semibold mt-0.5" style={{ color: colors.text }}>{summary.total}</p>
                </Card>
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  <p className="text-xs font-medium" style={{ color: colors.muted }}>7 days out or less</p>
                  <p className="text-xl font-semibold mt-0.5" style={{ color: colors.text }}>{summary.withinSeven}</p>
                </Card>
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  <p className="text-xs font-medium" style={{ color: colors.muted }}>Check-ins due today</p>
                  <p className="text-xl font-semibold mt-0.5" style={{ color: colors.text }}>{summary.checkInsDueToday}</p>
                </Card>
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  <p className="text-xs font-medium" style={{ color: colors.muted }}>Needing update</p>
                  <p className="text-xl font-semibold mt-0.5" style={{ color: summary.needingUpdate > 0 ? colors.warning : colors.text }}>{summary.needingUpdate}</p>
                </Card>
              </div>
            </section>

            {/* Athlete list */}
            <section>
              <div style={sectionLabel}>Athletes</div>
              {(data?.rows?.length ?? 0) === 0 ? (
                <Card style={{ ...cardStyle, padding: spacing[24], textAlign: 'center' }}>
                  <Calendar size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
                  <p className="text-[15px] font-medium" style={{ color: colors.text }}>No active peak weeks</p>
                  <p className="text-sm mt-1" style={{ color: colors.muted }}>
                    Add a peak week for a prep client to see them here.
                  </p>
                </Card>
              ) : (
                <ul className="space-y-0">
                  {(data?.rows ?? []).map((r) => {
                    const withinSeven = r.days_out != null && r.days_out <= 7;
                    const latestWeight = r.latest_checkin?.weight;
                    const readiness = r.latest_readiness;
                    const readinessLabel = readiness
                      ? [readiness.conditioning_score, readiness.fullness_score, readiness.dryness_score, readiness.fatigue_score]
                          .filter((s) => s != null)
                          .length
                        ? `C${readiness.conditioning_score ?? '—'} F${readiness.fullness_score ?? '—'} D${readiness.dryness_score ?? '—'}`
                        : '—'
                      : '—';
                    return (
                      <li key={r.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <Card
                          style={{
                            ...cardStyle,
                            borderRadius: 0,
                            borderLeft: withinSeven ? `4px solid ${colors.primary}` : undefined,
                            background: withinSeven ? colors.surface1 : undefined,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate" style={{ color: colors.text }}>{r.client_name}</p>
                              <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                                Show: {r.show_date ? new Date(r.show_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                {r.division ? ` · ${r.division}` : ''}
                              </p>
                            </div>
                            <span
                              className="shrink-0 px-2 py-1 rounded-md text-xs font-medium"
                              style={{ background: withinSeven ? colors.primarySubtle : colors.surface2, color: colors.text }}
                            >
                              {r.days_out != null ? `${r.days_out} days out` : '—'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                            <div className="flex items-center gap-1.5">
                              <Scale size={14} style={{ color: colors.muted }} />
                              <span style={{ color: colors.muted }}>Weight</span>
                              <span className="font-medium" style={{ color: colors.text }}>
                                {latestWeight != null ? `${Number(latestWeight)} kg` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Activity size={14} style={{ color: colors.muted }} />
                              <span style={{ color: colors.muted }}>Readiness</span>
                              <span className="font-medium truncate" style={{ color: colors.text }}>{readinessLabel}</span>
                            </div>
                            {r.latest_checkin && (
                              <p className="text-xs col-span-2" style={{ color: colors.muted }}>
                                Last check-in: {new Date(r.latest_checkin.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}/peak-week-editor`); }}
                            >
                              <Calendar size={14} /> Open Peak Week
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}/peak-week`); }}
                            >
                              <ClipboardList size={14} /> Review Check-In
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigate(`/messages/${r.client_id}`); }}
                            >
                              <MessageSquare size={14} /> Message Client
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
