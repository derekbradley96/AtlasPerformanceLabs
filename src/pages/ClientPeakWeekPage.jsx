/**
 * Client-facing Peak Week – prep athletes see daily instructions (Day -7 → Show day).
 * Uses peak_weeks + peak_week_days. Competition clients only; transformation clients see not-available state.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, sectionLabel, sectionGap } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Circle } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
        .select('id, show_date, division')
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
  const loading = loadingClient || loadingPeakWeek || loadingDays;
  const hasPeakWeek = peakWeek != null && (Array.isArray(days) ? days : []).length > 0;
  const loadError = errorClient || errorPeakWeek;
  const handleRetry = () => { refetchClient(); refetchPeakWeek(); };

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p style={{ color: colors.muted }}>Sign in to view your peak week.</p>
          <button type="button" onClick={() => navigate(-1)} className="mt-2 text-sm" style={{ color: colors.primary }}>Back</button>
        </div>
      </div>
    );
  }

  if (loadError && user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
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
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
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
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
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
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
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
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Peak Week" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        {loading ? (
          <div style={{ padding: spacing[16] }}>
            <CardSkeleton count={3} />
          </div>
        ) : (
          <>
            {/* Current day card */}
            <section style={{ marginBottom: sectionGap }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={sectionLabel}>
                {todayDay ? (todayDay.day_label || `Day ${todayDay.day_number}`) : 'Today'}
                {todayDay?.target_date && (
                  <span className="font-normal ml-2" style={{ color: colors.muted }}>
                    {todayDay.target_date}
                  </span>
                )}
              </h2>
              <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell?.cardRadius ?? 8 }}>
                {todayDay ? (
                  <>
                    <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Carbs (g)</p>
                        <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay.carbs_g ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Water (L)</p>
                        <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay.water_l ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Sodium (mg)</p>
                        <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay.sodium_mg ?? '—'}</p>
                      </div>
                    </div>
                    {todayDay.training_notes && (
                      <div className="mb-3">
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Training notes</p>
                        <p className="text-sm" style={{ color: colors.text }}>{todayDay.training_notes}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 mb-3">
                      <span className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                        {todayDay.posing_required ? <CheckCircle size={16} style={{ color: colors.primary }} /> : <Circle size={16} style={{ color: colors.muted }} />}
                        Posing {todayDay.posing_required ? 'required' : 'not required'}
                      </span>
                      <span className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                        {todayDay.checkin_required ? <CheckCircle size={16} style={{ color: colors.primary }} /> : <Circle size={16} style={{ color: colors.muted }} />}
                        Check-in {todayDay.checkin_required ? 'required' : 'not required'}
                      </span>
                    </div>
                    {todayDay.notes && (
                      <div className="pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Notes</p>
                        <p className="text-sm" style={{ color: colors.text }}>{todayDay.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: colors.muted }}>
                    No instructions for today. Your peak week runs from Day -7 to show day ({peakWeek?.show_date ? new Date(peakWeek.show_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}).
                  </p>
                )}
              </Card>
            </section>

            {/* Full peak week timeline */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={sectionLabel}>
                Peak week timeline
              </h2>
              <div className="flex flex-wrap gap-2">
                {daysList.map((d) => {
                  const isToday = d.target_date === todayStr;
                  const dayLabel = d.day_label || `Day ${d.day_number}`;
                  const dateLabel = d.target_date
                    ? new Date(d.target_date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    : '';
                  return (
                    <div
                      key={d.id || d.day_number}
                      style={{
                        padding: `${spacing[8]}px ${spacing[12]}px`,
                        borderRadius: shell?.cardRadius ?? 8,
                        border: `1px solid ${isToday ? colors.primary : colors.border}`,
                        background: isToday ? colors.primarySubtle : colors.surface2,
                        color: isToday ? colors.primary : colors.text,
                        fontWeight: isToday ? 600 : 400,
                        fontSize: 13,
                        minWidth: 80,
                        textAlign: 'center',
                      }}
                    >
                      <div>{dayLabel}</div>
                      {dateLabel && <div className="text-xs mt-0.5" style={{ opacity: 0.9 }}>{dateLabel}</div>}
                      {isToday && <div className="text-xs mt-1 font-medium" style={{ opacity: 0.9 }}>Today</div>}
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full"
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
