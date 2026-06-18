/**
 * Coach Peak Week Dashboard – prep coaches manage athletes approaching show day.
 * Competition and integrated focus only; transformation shows not-available state.
 * Data: peak_weeks, clients, peak_week_checkins, stage_readiness_scores.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToThread } from '@/lib/messagesPath';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { PeakWeekDashboardSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { Calendar, MessageSquare, ClipboardList, Scale, Activity, AlertTriangle, CheckCircle2, Circle, LayoutTemplate, ListChecks } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';
import { resolveViewerBodyweightUnit, formatWeightForViewer } from '@/lib/bodyMeasurementUnits';

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

/** Fetch active peak weeks for coach with client name, latest check-in, latest readiness, and today's compliance. */
async function fetchPeakWeekDashboard(coachId) {
  if (!hasSupabase || !coachId) return { rows: [], checkinsByPeakWeek: {}, readinessByClient: {}, complianceByClient: {} };
  const supabase = getSupabase();
  if (!supabase) return { rows: [], checkinsByPeakWeek: {}, readinessByClient: {}, complianceByClient: {} };
  try {
    const { data: weeks, error: weeksErr } = await supabase
      .from('peak_weeks')
      .select('id, client_id, coach_id, contest_prep_id, show_date, division, created_at, is_active')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('show_date', { ascending: true });
    if (weeksErr || !Array.isArray(weeks) || weeks.length === 0) {
      return { rows: weeks || [], checkinsByPeakWeek: {}, readinessByClient: {}, complianceByClient: {} };
    }
    const peakWeekIds = weeks.map((w) => w.id);
    const clientIds = [...new Set(weeks.map((w) => w.client_id))];
    const todayIso = new Date().toISOString().slice(0, 10);
    const startIso = `${todayIso}T00:00:00.000Z`;
    const endIso = `${todayIso}T23:59:59.999Z`;
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
    const { data: todayDays } = await supabase
      .from('peak_week_days')
      .select('id, peak_week_id, target_date, morning_checkin_required, evening_checkin_required')
      .in('peak_week_id', peakWeekIds)
      .eq('target_date', todayIso);
    const todayDayByPeakWeek = {};
    (todayDays || []).forEach((d) => {
      if (d?.peak_week_id && !todayDayByPeakWeek[d.peak_week_id]) todayDayByPeakWeek[d.peak_week_id] = d;
    });
    const todayDayIds = (todayDays || []).map((d) => d.id).filter(Boolean);
    let todayStatusByClient = {};
    if (todayDayIds.length) {
      const { data: statuses } = await supabase
        .from('peak_week_day_status')
        .select('peak_week_day_id, client_id, macros_completed, water_completed, cardio_completed, posing_completed, morning_checkin_completed, evening_checkin_completed')
        .in('peak_week_day_id', todayDayIds)
        .in('client_id', clientIds);
      (statuses || []).forEach((s) => {
        todayStatusByClient[`${s.client_id}:${s.peak_week_day_id}`] = s;
      });
    }
    const { data: todayCheckins } = await supabase
      .from('peak_week_checkins')
      .select('client_id, peak_week_id, checkin_period, created_at')
      .in('peak_week_id', peakWeekIds)
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    const todayCheckinPeriodsByClient = {};
    (todayCheckins || []).forEach((c) => {
      if (!c?.client_id) return;
      if (!todayCheckinPeriodsByClient[c.client_id]) todayCheckinPeriodsByClient[c.client_id] = new Set();
      todayCheckinPeriodsByClient[c.client_id].add(c.checkin_period || 'evening');
    });
    const rows = weeks.map((w) => ({
      ...w,
      client_name: nameByClientId[w.client_id] || 'Client',
      days_out: daysOut(w.show_date),
      latest_checkin: latestCheckinByPeakWeek[w.id] ?? null,
      latest_readiness: latestReadinessByClient[w.client_id] ?? null,
    }));
    const complianceByClient = {};
    rows.forEach((r) => {
      const todayDay = todayDayByPeakWeek[r.id] || null;
      const todayStatus = todayDay ? (todayStatusByClient[`${r.client_id}:${todayDay.id}`] || null) : null;
      const checkinPeriods = todayCheckinPeriodsByClient[r.client_id] || new Set();
      const morningRequired = !!todayDay?.morning_checkin_required;
      const eveningRequired = !!todayDay?.evening_checkin_required;
      const checkinsCompleted =
        !todayDay
          ? false
          : (morningRequired ? checkinPeriods.has('morning') || !!todayStatus?.morning_checkin_completed : true) &&
            (eveningRequired ? checkinPeriods.has('evening') || !!todayStatus?.evening_checkin_completed : true);
      const hasRequiredItems = !!todayDay;
      const missingRequired =
        hasRequiredItems &&
        (
          !todayStatus?.macros_completed ||
          !todayStatus?.water_completed ||
          !todayStatus?.cardio_completed ||
          !todayStatus?.posing_completed ||
          !checkinsCompleted
        );
      complianceByClient[r.client_id] = {
        peakWeekId: r.id,
        todayDayId: todayDay?.id || null,
        hasRequiredItems,
        macrosCompleted: !!todayStatus?.macros_completed,
        waterCompleted: !!todayStatus?.water_completed,
        cardioCompleted: !!todayStatus?.cardio_completed,
        posingCompleted: !!todayStatus?.posing_completed,
        checkinsCompleted,
        checkinPeriodsLabel:
          `${morningRequired ? 'Morning' : ''}${morningRequired && eveningRequired ? ' + ' : ''}${eveningRequired ? 'Evening' : ''}` || 'None',
        missingRequired,
      };
    });
    return { rows, checkinsByPeakWeek: latestCheckinByPeakWeek, readinessByClient: latestReadinessByClient, complianceByClient };
  } catch (error) {
    throw error;
  }
}

function PeakWeekDeployTemplateSheet({
  open,
  onClose,
  clientId,
  contestPrepId,
  showDate,
  coachId,
  onDeployed,
  navigate,
}) {
  const [templates, setTemplates] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [deploying, setDeploying] = React.useState(false);
  const supabase = hasSupabase ? getSupabase() : null;

  React.useEffect(() => {
    if (!open || !supabase || !coachId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('peak_week_templates')
      .select('id, name, days, division')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, supabase, coachId]);

  const handleDeploy = async () => {
    if (!preview?.days || !supabase || !clientId || !contestPrepId || !showDate || deploying) return;
    setDeploying(true);
    try {
      const { deployPeakWeekTemplateToAthlete } = await import('@/lib/peakWeekTemplateDeploy');
      const out = await deployPeakWeekTemplateToAthlete(supabase, {
        clientId,
        contestPrepId,
        showDate,
        templateDays: preview.days,
      });
      if (out.ok) {
        toast.success('Peak week template deployed');
        onDeployed?.();
        onClose?.();
      } else {
        toast.error(out.error || 'Deploy failed');
      }
    } finally {
      setDeploying(false);
    }
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(2,6,23,0.65)' }}
      role="dialog"
      aria-modal
    >
      <button type="button" className="flex-1 w-full border-0 cursor-default" style={{ background: 'transparent' }} onClick={onClose} aria-label="Close" />
      <div
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto"
        style={{ background: colors.surface, borderTop: `1px solid ${colors.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-6">
          <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Deploy peak week template</p>
          {loading ? (
            <p className="text-xs" style={{ color: colors.muted }}>Loading templates…</p>
          ) : templates.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: colors.muted }}>No templates yet.</p>
              <Button variant="default" className="w-full" onClick={() => { hapticLight(); onClose?.(); navigate?.('/peak-week-templates'); }}>
                Create your first peak week template
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left rounded-lg border p-3 text-sm"
                    style={{
                      borderColor: preview?.id === t.id ? colors.primary : colors.border,
                      background: preview?.id === t.id ? colors.primarySubtle : colors.surface2,
                      color: colors.text,
                    }}
                    onClick={() => setPreview(t)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {preview && Array.isArray(preview.days) && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase mb-2" style={{ color: colors.muted }}>7-day preview</p>
                  <ul className="space-y-2 text-xs" style={{ color: colors.text }}>
                    {preview.days.slice(0, 7).map((d, i) => (
                      <li key={i} className="rounded border p-2" style={{ borderColor: colors.border }}>
                        <span className="font-medium">{d.label || `Day ${d.day}`}</span>
                        {d.carbs_g != null && <span className="ml-2" style={{ color: colors.muted }}>C {d.carbs_g}g</span>}
                        {d.water_litres != null && <span className="ml-2" style={{ color: colors.muted }}>W {d.water_litres}L</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button className="flex-1" disabled={!preview || deploying} onClick={handleDeploy}>
                  {deploying ? 'Deploying…' : 'Deploy to athlete'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoachPeakWeekDashboard({ embedded = false }) {
  const navigate = useNavigate();
  const { user, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const viewerWU = resolveViewerBodyweightUnit(profile);
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPeakWeek = showPeakWeekByFocus(coachFocus);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState({ rows: [], checkinsByPeakWeek: {}, readinessByClient: {}, complianceByClient: {} });
  const [deploySheet, setDeploySheet] = useState(null);

  const coachId = user?.id ?? null;

  const refetch = React.useCallback(() => {
    setError(false);
    if (!coachId) return;
    setLoading(true);
    fetchPeakWeekDashboard(coachId)
      .then((out) => {
        setData(out ?? { rows: [], checkinsByPeakWeek: {}, readinessByClient: {}, complianceByClient: {} });
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
        if (!cancelled) setData(out ?? { rows: [], checkinsByPeakWeek: {}, readinessByClient: {}, complianceByClient: {} });
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
  const complianceRows = useMemo(() => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return rows.map((r) => ({
      ...r,
      compliance: data?.complianceByClient?.[r.client_id] || null,
    }));
  }, [data?.complianceByClient, data?.rows]);

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
    <div className={embedded ? '' : 'min-h-screen pb-8'} style={{ background: colors.bg, color: colors.text }}>
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        {!embedded && <h1 className="atlas-page-title">Peak Week Dashboard</h1>}
        {!embedded && (
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
            Athletes approaching show day. Open peak week plan, review check-ins, message clients.
          </p>
        )}

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
            <section style={{ marginBottom: sectionGap }}>
              <div style={sectionLabel}>Today&apos;s Compliance</div>
              {(complianceRows.length ?? 0) === 0 ? (
                <Card style={{ ...cardStyle, padding: spacing[16] }}>
                  <p className="text-sm" style={{ color: colors.muted }}>No active peak week clients to review today.</p>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {complianceRows.map((row) => {
                    const c = row.compliance;
                    const warning = !!c?.missingRequired;
                    const StatusIcon = warning ? AlertTriangle : CheckCircle2;
                    const statusColor = warning ? colors.warning : colors.success;
                    const items = [
                      { label: 'Macros', done: !!c?.macrosCompleted },
                      { label: 'Water', done: !!c?.waterCompleted },
                      { label: 'Cardio', done: !!c?.cardioCompleted },
                      { label: 'Posing', done: !!c?.posingCompleted },
                      { label: 'Check-ins', done: !!c?.checkinsCompleted },
                    ];
                    return (
                      <li key={`compliance-${row.id}`}>
                        <Card
                          style={{
                            ...cardStyle,
                            borderLeft: `4px solid ${statusColor}`,
                            background: warning ? colors.surface1 : colors.surface,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-semibold" style={{ color: colors.text }}>{row.client_name}</p>
                              <p className="text-xs" style={{ color: colors.muted }}>
                                {c?.hasRequiredItems ? `Required check-ins: ${c.checkinPeriodsLabel}` : 'No day scheduled for today'}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: statusColor }}>
                              <StatusIcon size={14} />
                              {warning ? 'Needs follow-up' : 'On track'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                            {items.map((item) => (
                              <div key={item.label} className="flex items-center gap-1.5 text-sm">
                                {item.done ? <CheckCircle2 size={14} style={{ color: colors.success }} /> : <Circle size={14} style={{ color: colors.muted }} />}
                                <span style={{ color: colors.muted }}>{item.label}</span>
                                <span className="font-medium" style={{ color: colors.text }}>{item.done ? 'Done' : 'Pending'}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigateToThread(navigate, row.client_id); }}
                            >
                              <MessageSquare size={14} /> Message client
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigate(`/clients/${row.client_id}/peak-week-editor`); }}
                            >
                              <Calendar size={14} /> Open day
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigate(`/review-center/peak-week-checkins`); }}
                            >
                              <ClipboardList size={14} /> Review check-in
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Athlete list */}
            <section>
              <div style={sectionLabel}>Athletes</div>
              {(data?.rows?.length ?? 0) === 0 ? (
                <Card style={{ ...cardStyle, padding: spacing[24], textAlign: 'center' }}>
                  <Calendar size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
                  <p className="text-[15px] font-medium" style={{ color: colors.text }}>No active peak week</p>
                  <p className="text-sm mt-1" style={{ color: colors.muted }}>
                    Create a peak week from any prep client profile to unlock daily controls and compliance tracking.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => { hapticLight(); navigate('/clients'); }}>
                    Open clients
                  </Button>
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
                                {latestWeight != null ? formatWeightForViewer(Number(latestWeight), viewerWU) : '—'}
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
                              onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}/peak-week-editor`); }}
                            >
                              <ClipboardList size={14} /> Review Check-In
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => { hapticLight(); navigateToThread(navigate, r.client_id); }}
                            >
                              <MessageSquare size={14} /> Message Client
                            </Button>
                            {r.contest_prep_id && r.show_date && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="inline-flex items-center gap-1.5"
                                  onClick={() => {
                                    hapticLight();
                                    setDeploySheet({
                                      clientId: r.client_id,
                                      contestPrepId: r.contest_prep_id,
                                      showDate: r.show_date,
                                    });
                                  }}
                                >
                                  <LayoutTemplate size={14} /> Deploy template
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="inline-flex items-center gap-1.5"
                                  onClick={() => { hapticLight(); navigate(`/prep/${r.contest_prep_id}/show-checklist`); }}
                                >
                                  <ListChecks size={14} /> Show day checklist
                                </Button>
                              </>
                            )}
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
      <PeakWeekDeployTemplateSheet
        open={!!deploySheet}
        onClose={() => setDeploySheet(null)}
        clientId={deploySheet?.clientId}
        contestPrepId={deploySheet?.contestPrepId}
        showDate={deploySheet?.showDate}
        coachId={coachId}
        navigate={navigate}
        onDeployed={refetch}
      />
    </div>
  );
}
