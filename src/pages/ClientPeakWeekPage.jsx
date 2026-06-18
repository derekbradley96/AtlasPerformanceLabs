/**
 * Client-facing Peak Week – prep athletes see daily instructions (Day -7 → Show day).
 * Uses peak_weeks + peak_week_days. Competition clients only; transformation clients see not-available state.
 */
import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell, shadows, touchTargetMin } from '@/ui/tokens';
import { pageContainer, sectionLabel, sectionGap } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Circle, Clock3, ListChecks } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';

function buildPlanSnapshot(day) {
  if (!day) return null;
  return {
    carbs_g: day.carbs_g ?? null,
    water_l: day.water_l ?? null,
    sodium_mg: day.sodium_mg ?? null,
    cardio_minutes: day.cardio_minutes ?? null,
    training_type: day.training_type ?? null,
    training_notes: day.training_notes ?? null,
  };
}

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntilShow(showDateStr, todayIso) {
  if (!showDateStr || !todayIso) return null;
  const show = new Date(`${showDateStr}T12:00:00`);
  const today = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(show.getTime()) || Number.isNaN(today.getTime())) return null;
  return Math.round((show.getTime() - today.getTime()) / 86400000);
}

function resolveClientAndCoachFocus(supabase, userId) {
  if (!supabase || !userId) return Promise.resolve({ clientId: null, coachFocus: null });
  return supabase
    .from('clients')
    .select('id, coach_id, trainer_id')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data: client }) => {
      if (!client) return { clientId: null, coachFocus: null };
      const coachId = client.coach_id || client.trainer_id;
      if (!coachId) return { clientId: client.id, coachFocus: null };
      return supabase
        .from('profiles')
        .select('coach_focus')
        .eq('id', coachId)
        .maybeSingle()
        .then(({ data: profile }) => ({
          clientId: client.id,
          coachFocus: (profile?.coach_focus || '').toString().trim().toLowerCase() || null,
        }));
    });
}

/** Competition clients: coach is competition or integrated. Transformation = not allowed to see this screen. */
function isCompetitionClient(coachFocus) {
  if (!coachFocus) return true; // no coach or unknown: show page, empty state if no peak week
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

export default function ClientPeakWeekPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const todayStr = useMemo(() => toISODate(new Date()), []);

  const { data: clientAndFocus, isLoading: loadingClient, isError: errorClient, refetch: refetchClient } = useQuery({
    queryKey: ['client-peak-week-identity', user?.id],
    queryFn: () => resolveClientAndCoachFocus(supabase, user?.id),
    enabled: !!supabase && !!user?.id,
  });

  const clientId = clientAndFocus?.clientId ?? null;
  const coachFocus = clientAndFocus?.coachFocus ?? null;
  const canSeePeakWeek = isCompetitionClient(coachFocus);

  const { data: peakWeek, isLoading: loadingPeakWeek, isError: errorPeakWeek, refetch: refetchPeakWeek } = useQuery({
    queryKey: ['peak_weeks_active', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data } = await supabase
        .from('peak_weeks')
        .select('id, show_date, division, contest_prep_id')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('show_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!supabase && !!clientId && canSeePeakWeek,
  });

  const { data: days = [], isLoading: loadingDays } = useQuery({
    queryKey: ['peak_week_days', peakWeek?.id],
    queryFn: async () => {
      if (!supabase || !peakWeek?.id) return [];
      const { data, error } = await supabase
        .from('peak_week_days')
        .select('*')
        .eq('peak_week_id', peakWeek.id)
        .order('day_number', { ascending: true });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!peakWeek?.id,
  });

  const daysList = Array.isArray(days) ? days : [];
  const todayDay = useMemo(
    () => daysList.find((d) => d && d.target_date === todayStr),
    [daysList, todayStr]
  );
  const { data: todayStatus } = useQuery({
    queryKey: ['peak_week_day_status_today', todayDay?.id, clientId],
    queryFn: async () => {
      if (!supabase || !todayDay?.id || !clientId) return null;
      const { data, error } = await supabase
        .from('peak_week_day_status')
        .select('*')
        .eq('peak_week_day_id', todayDay.id)
        .eq('client_id', clientId)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!todayDay?.id && !!clientId,
  });

  const toggleChecklistItem = useMutation({
    mutationFn: async ({ key, value }) => {
      if (!supabase || !todayDay?.id || !clientId || !key) throw new Error('Missing day status context');
      const payload = {
        peak_week_day_id: todayDay.id,
        client_id: clientId,
        [key]: value,
      };
      const { error } = await supabase
        .from('peak_week_day_status')
        .upsert(payload, { onConflict: 'peak_week_day_id,client_id' });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peak_week_day_status_today', todayDay?.id, clientId] });
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't update checklist");
    },
  });
  const daysOut = useMemo(
    () => (peakWeek?.show_date ? daysUntilShow(peakWeek.show_date, todayStr) : null),
    [peakWeek?.show_date, todayStr]
  );
  const loading = loadingClient || loadingPeakWeek || loadingDays;
  const hasPeakWeek = peakWeek != null && (Array.isArray(days) ? days : []).length > 0;
  const loadError = errorClient || errorPeakWeek;
  const handleRetry = () => { refetchClient(); refetchPeakWeek(); };

  const updatedRecently =
    !!todayDay?.updated_at &&
    Date.now() - new Date(todayDay.updated_at).getTime() <= 36 * 60 * 60 * 1000;
  const checkinDueLabel = todayDay
    ? `${todayDay.morning_checkin_required ? 'Morning' : ''}${todayDay.morning_checkin_required && todayDay.evening_checkin_required ? ' + ' : ''}${todayDay.evening_checkin_required ? 'Evening' : ''}`
    : '';

  const checklistRows = [
    { key: 'macros_completed', label: 'Macros completed' },
    { key: 'water_completed', label: 'Water completed' },
    { key: 'cardio_completed', label: 'Cardio completed' },
    { key: 'posing_completed', label: 'Posing completed' },
  ];
  const checkinsCompleted =
    !todayDay?.morning_checkin_required && !todayDay?.evening_checkin_required
      ? true
      : (todayDay?.morning_checkin_required ? !!todayStatus?.morning_checkin_completed : true) &&
        (todayDay?.evening_checkin_required ? !!todayStatus?.evening_checkin_completed : true);
  const viewedAt = todayStatus?.last_viewed_at ? new Date(todayStatus.last_viewed_at).getTime() : null;
  const dayUpdatedAt = todayDay?.updated_at ? new Date(todayDay.updated_at).getTime() : null;
  const wasUpdatedAfterViewed = !!(viewedAt && dayUpdatedAt && dayUpdatedAt > viewedAt);
  const lastSnapshot = todayStatus?.last_viewed_plan_snapshot || null;
  const changedFields = useMemo(() => {
    if (!wasUpdatedAfterViewed || !todayDay || !lastSnapshot) return {};
    const current = buildPlanSnapshot(todayDay);
    return {
      carbs_g: current.carbs_g !== (lastSnapshot.carbs_g ?? null),
      water_l: current.water_l !== (lastSnapshot.water_l ?? null),
      sodium_mg: current.sodium_mg !== (lastSnapshot.sodium_mg ?? null),
      cardio_minutes: current.cardio_minutes !== (lastSnapshot.cardio_minutes ?? null),
      training:
        current.training_type !== (lastSnapshot.training_type ?? null) ||
        current.training_notes !== (lastSnapshot.training_notes ?? null),
    };
  }, [lastSnapshot, todayDay, wasUpdatedAfterViewed]);

  useEffect(() => {
    if (!supabase || !todayDay?.id || !clientId) return;
    if (todayStatus?.last_viewed_at) return;
    const snapshot = buildPlanSnapshot(todayDay);
    // Ensure first-time viewers get a status row so update-detection works reliably.
    supabase
      .from('peak_week_day_status')
      .upsert(
        {
          peak_week_day_id: todayDay.id,
          client_id: clientId,
          last_viewed_at: new Date().toISOString(),
          last_viewed_plan_snapshot: snapshot,
        },
        { onConflict: 'peak_week_day_id,client_id' }
      )
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['peak_week_day_status_today', todayDay?.id, clientId] });
      });
  }, [clientId, queryClient, supabase, todayDay, todayStatus]);

  const markUpdateSeen = useMutation({
    mutationFn: async () => {
      if (!supabase || !todayDay?.id || !clientId) throw new Error('Missing update context');
      const payload = {
        peak_week_day_id: todayDay.id,
        client_id: clientId,
        last_viewed_at: new Date().toISOString(),
        last_viewed_plan_snapshot: buildPlanSnapshot(todayDay),
      };
      const { error } = await supabase
        .from('peak_week_day_status')
        .upsert(payload, { onConflict: 'peak_week_day_id,client_id' });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peak_week_day_status_today', todayDay?.id, clientId] });
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't mark update as seen");
    },
  });

  const updateChecklist = (key, value) => {
    toggleChecklistItem.mutate({ key, value });
  };

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div
          className="p-4 max-w-lg mx-auto"
          style={{
            ...pageContainer,
            paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>Sign in to view your peak week plan.</p>
          <button
            type="button"
            onClick={() => { hapticLight(); navigate(-1); }}
            className="mt-4 text-sm font-semibold rounded-lg w-full"
            style={{ color: colors.primary, background: colors.surface2, border: `1px solid ${colors.border}`, minHeight: touchTargetMin }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (loadError && user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div
          className="p-4 max-w-lg mx-auto"
          style={{
            ...pageContainer,
            paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <LoadErrorFallback
            title="Couldn't load peak week"
            description="Check your connection and try again."
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  if (!canSeePeakWeek) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div
          className="p-4 max-w-lg mx-auto"
          style={{
            ...pageContainer,
            paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <EmptyState
            title="Not available"
            description="Peak Week is for competition prep athletes. Your coach uses a transformation program."
            icon={Calendar}
            actionLabel="Back"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  if (!clientId && !loadingClient) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div
          className="p-4 max-w-lg mx-auto"
          style={{
            ...pageContainer,
            paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <EmptyState
            title="No coach linked"
            description="Peak Week is for prep athletes. Link with a coach to get started."
            icon={Calendar}
            actionLabel="Back"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  if (!hasPeakWeek && !loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div
          className="p-4 max-w-lg mx-auto"
          style={{
            ...pageContainer,
            paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <EmptyState
            title="No peak week yet"
            description="Your coach will add your peak week when you're in prep. Check back or ask your coach."
            icon={Calendar}
            actionLabel="Back"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingBottom: `calc(${spacing[32]}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <TopBar title="Peak Week" onBack={() => navigate(-1)} />
      <div
        className="max-w-lg mx-auto"
        style={{
          ...pageContainer,
          paddingBottom: spacing[16],
        }}
      >
        {loading ? (
          <div style={{ padding: spacing[16], minHeight: 200 }}>
            <Card style={{ padding: spacing[16], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
              <p className="text-xs" style={{ color: colors.muted, marginBottom: spacing[8] }}>Loading peak week</p>
              <div className="h-6 rounded animate-pulse" style={{ background: colors.surface2, marginBottom: spacing[8] }} />
              <div className="h-4 rounded animate-pulse" style={{ background: colors.surface2, width: '70%' }} />
            </Card>
            <CardSkeleton count={3} />
          </div>
        ) : (
          <>
            {/* Countdown + context */}
            {daysOut != null && (
              <div
                className="mb-4 rounded-xl px-4 py-3"
                style={{
                  background: colors.surface2,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                  {daysOut > 0 && `Show day in ${daysOut} day${daysOut === 1 ? '' : 's'}`}
                  {daysOut === 0 && 'Show day is today'}
                  {daysOut < 0 && `Show was ${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? '' : 's'} ago`}
                </p>
                <p className="text-xs mt-1" style={{ color: colors.muted }}>
                  Follow the targets below for the calendar day that matches today. Your coach sets Day -7 through show day.
                </p>
                {peakWeek?.contest_prep_id && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full justify-center gap-2"
                    style={{ minHeight: touchTargetMin }}
                    onClick={() => { hapticLight(); navigate(`/prep/${peakWeek.contest_prep_id}/show-checklist`); }}
                  >
                    <ListChecks size={16} /> Show day checklist
                  </Button>
                )}
              </div>
            )}

            {/* Full peak week timeline (first — orientation) */}
            <section style={{ marginBottom: sectionGap }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={sectionLabel}>
                Your week at a glance
              </h2>
              <div
                className="overflow-x-auto pb-2 -mx-1"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex items-center gap-0 px-1" style={{ width: 'max-content' }}>
                  {daysList.map((d, i) => {
                    const isToday = d.target_date === todayStr;
                    const dayLabel = d.day_label || `Day ${d.day_number}`;
                    const dateLabel = d.target_date
                      ? new Date(`${d.target_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                      : '';
                    const isLast = i === daysList.length - 1;
                    return (
                      <React.Fragment key={d.id || d.day_number}>
                        <div
                          className="flex flex-col items-center shrink-0"
                          style={{
                            transform: isToday ? 'scale(1.06)' : undefined,
                            transformOrigin: 'center bottom',
                          }}
                        >
                          <div
                            style={{
                              padding: `${spacing[10]}px ${spacing[12]}px`,
                              borderRadius: shell?.cardRadius ?? 12,
                              border: `2px solid ${isToday ? colors.primary : colors.border}`,
                              background: isToday ? colors.primarySubtle : colors.surface2,
                              color: isToday ? colors.primary : colors.text,
                              fontWeight: isToday ? 700 : 500,
                              fontSize: isToday ? 14 : 12,
                              minWidth: isToday ? 96 : 76,
                              textAlign: 'center',
                              boxShadow: isToday ? shadows.brandGlow : 'none',
                            }}
                          >
                            <div>{dayLabel}</div>
                            {dateLabel && (
                              <div className="text-[11px] mt-1 font-normal" style={{ color: isToday ? colors.accent : colors.muted }}>
                                {dateLabel}
                              </div>
                            )}
                            {isToday && (
                              <div
                                className="text-[10px] mt-1.5 font-bold uppercase tracking-wider"
                                style={{ color: colors.primary }}
                              >
                                Today
                              </div>
                            )}
                          </div>
                        </div>
                        {!isLast && (
                          <div
                            className="shrink-0 self-center h-0.5 w-3 sm:w-4"
                            style={{
                              background: isToday || daysList[i + 1]?.target_date === todayStr ? colors.primary : colors.border,
                              opacity: 0.85,
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Current day — hero targets */}
            <section style={{ marginBottom: sectionGap }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={sectionLabel}>
                {todayDay ? "Today's plan" : 'No plan for this calendar day'}
              </h2>
              <Card
                style={{
                  position: 'relative',
                  padding: spacing[20],
                  border: `2px solid ${todayDay ? colors.primary : colors.border}`,
                  borderRadius: shell?.cardRadius ?? 8,
                  boxShadow: todayDay ? shadows.brandGlow : undefined,
                  background: todayDay ? 'rgba(59, 130, 246, 0.06)' : undefined,
                }}
              >
                {todayDay && wasUpdatedAfterViewed && (
                  <div
                    className="mb-3 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
                    style={{
                      border: `1px solid ${colors.warning}`,
                      background: colors.warningSubtle,
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>
                      Coach updated today&apos;s peak week plan
                    </p>
                    <button
                      type="button"
                      onClick={() => markUpdateSeen.mutate()}
                      className="text-xs font-semibold px-2 py-1 rounded-md"
                      style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text }}
                    >
                      Mark seen
                    </button>
                  </div>
                )}
                {todayDay && (
                  <div
                    className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{ background: colors.primary, color: '#fff' }}
                  >
                    Today
                  </div>
                )}
                {todayDay ? (
                  <>
                    <p className="text-base font-semibold pr-20 mb-1" style={{ color: colors.text }}>
                      {todayDay.day_label || `Day ${todayDay.day_number}`}
                      {todayDay.day_number != null && (
                        <span className="font-normal text-sm ml-2" style={{ color: colors.muted }}>
                          (Day {todayDay.day_number})
                        </span>
                      )}
                    </p>
                    {todayDay.target_date && (
                      <p className="text-xs mb-4" style={{ color: colors.muted }}>
                        {new Date(`${todayDay.target_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    )}
                    <p className="text-xs mb-4 font-medium" style={{ color: colors.accent }}>
                      Hit these targets unless your coach tells you otherwise.
                    </p>
                    {updatedRecently && (
                      <div
                        className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: colors.primarySubtle, color: colors.primary, border: `1px solid ${colors.primary}` }}
                      >
                        <Clock3 size={13} />
                        Updated by coach recently
                      </div>
                    )}
                    <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>
                          Carbs (g){changedFields.carbs_g ? ' • Updated' : ''}
                        </p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.carbs_g ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Protein (g)</p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.protein_g ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Fats (g)</p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.fats_g ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>
                          Water (L){changedFields.water_l ? ' • Updated' : ''}
                        </p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.water_l ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>
                          Sodium (mg){changedFields.sodium_mg ? ' • Updated' : ''}
                        </p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.sodium_mg ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Steps</p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.steps_target ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>
                          Cardio (min){changedFields.cardio_minutes ? ' • Updated' : ''}
                        </p>
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{todayDay.cardio_minutes ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Training type</p>
                        <p className="text-base font-semibold capitalize" style={{ color: colors.text }}>
                          {(todayDay.training_type || 'custom').replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    {todayDay.training_notes && (
                      <div className="mb-3">
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>
                          Training{changedFields.training ? ' • Updated' : ''}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: colors.text }}>{todayDay.training_notes}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 mb-3">
                      <span className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                        {todayDay.posing_required ? <CheckCircle size={16} style={{ color: colors.primary }} /> : <Circle size={16} style={{ color: colors.muted }} />}
                        Posing {todayDay.posing_required ? 'due today' : 'not required'}
                      </span>
                      <span className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                        {(todayDay.morning_checkin_required || todayDay.evening_checkin_required) ? <CheckCircle size={16} style={{ color: colors.primary }} /> : <Circle size={16} style={{ color: colors.muted }} />}
                        Check-ins {(todayDay.morning_checkin_required || todayDay.evening_checkin_required) ? `${checkinDueLabel} due` : 'not required'}
                      </span>
                    </div>
                    {todayDay.posing_notes && (
                      <div className="mb-3">
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Posing notes</p>
                        <p className="text-sm leading-relaxed" style={{ color: colors.text }}>{todayDay.posing_notes}</p>
                      </div>
                    )}
                    {todayDay.notes && (
                      <div className="pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Coach notes</p>
                        <p className="text-sm leading-relaxed" style={{ color: colors.text }}>{todayDay.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                    There is no peak-week row for today&apos;s date. That usually means you&apos;re before Day -7 or after show day, or dates are still being set up. Show day{' '}
                    {peakWeek?.show_date
                      ? new Date(peakWeek.show_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                    . Use the timeline above to see the full week.
                  </p>
                )}
              </Card>
            </section>
            {todayDay && !(todayDay.carbs_g != null || todayDay.water_l != null || todayDay.sodium_mg != null || todayDay.cardio_minutes != null || todayDay.training_notes) && (
              <section style={{ marginBottom: sectionGap }}>
                <Card style={{ padding: spacing[14], border: `1px dashed ${colors.border}`, borderRadius: shell?.cardRadius ?? 8 }}>
                  <p className="text-sm font-medium" style={{ color: colors.text }}>No daily targets set yet</p>
                  <p className="text-xs mt-1" style={{ color: colors.muted }}>
                    Your coach has not set today&apos;s detailed targets yet. Check back soon or message your coach.
                  </p>
                </Card>
              </section>
            )}
            {todayDay && (
              <section style={{ marginBottom: sectionGap }}>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={sectionLabel}>
                  Today&apos;s checklist
                </h2>
                <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell?.cardRadius ?? 8 }}>
                  <div className="flex flex-col gap-2">
                    {checklistRows.map((row) => {
                      const checked = !!todayStatus?.[row.key];
                      return (
                        <button
                          key={row.key}
                          type="button"
                          onClick={() => updateChecklist(row.key, !checked)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minHeight: 46,
                            borderRadius: 8,
                            border: `1px solid ${checked ? colors.primary : colors.border}`,
                            background: checked ? colors.primarySubtle : colors.surface2,
                            color: colors.text,
                            padding: `0 ${spacing[10]}px`,
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{row.label}</span>
                          {checked ? <CheckCircle size={16} style={{ color: colors.primary }} /> : <Circle size={16} style={{ color: colors.muted }} />}
                        </button>
                      );
                    })}
                    {(todayDay.morning_checkin_required || todayDay.evening_checkin_required) && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextValue = !checkinsCompleted;
                          if (todayDay.morning_checkin_required) {
                            updateChecklist('morning_checkin_completed', nextValue);
                          }
                          if (todayDay.evening_checkin_required) {
                            updateChecklist('evening_checkin_completed', nextValue);
                          }
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: 46,
                          borderRadius: 8,
                          border: `1px solid ${checkinsCompleted ? colors.primary : colors.border}`,
                          background: checkinsCompleted ? colors.primarySubtle : colors.surface2,
                          color: colors.text,
                          padding: `0 ${spacing[10]}px`,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          Check-ins completed ({checkinDueLabel})
                        </span>
                        {checkinsCompleted ? <CheckCircle size={16} style={{ color: colors.primary }} /> : <Circle size={16} style={{ color: colors.muted }} />}
                      </button>
                    )}
                    {!todayDay.morning_checkin_required && !todayDay.evening_checkin_required && (
                      <div
                        className="mt-1 rounded-lg px-3 py-2 text-xs font-medium"
                        style={{ border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.muted }}
                      >
                        No check-in due today.
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            )}
            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full font-semibold"
                style={{ minHeight: touchTargetMin }}
                onClick={() => { hapticLight(); navigate('/peak-week-checkin'); }}
              >
                Submit peak week check-in
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
