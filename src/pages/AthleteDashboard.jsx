/**
 * Unified athlete dashboard: today workout, momentum score, nutrition targets,
 * supplement stack, progress trends. Client-facing single view.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dumbbell,
  TrendingUp,
  UtensilsCrossed,
  Pill,
  Activity,
  ChevronRight,
  Target,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getMyClientId, getWeekStartISO } from '@/lib/checkins';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import HabitAdherenceCard from '@/components/habits/HabitAdherenceCard';
import { colors, spacing } from '@/ui/tokens';
import { PageLoader, MomentumCardSkeleton } from '@/components/ui/LoadingState';
import { getAthleteProgressInsights } from '@/lib/athleteProgressInsights';
import { calculateMomentumScore, MOMENTUM_STATUS } from '@/lib/momentumEngine';

const MOMENTUM_KEYS = [
  { key: 'training_score', label: 'Training', icon: Dumbbell },
  { key: 'nutrition_score', label: 'Nutrition', icon: UtensilsCrossed },
  { key: 'steps_score', label: 'Steps', icon: Activity },
];

async function fetchMomentum(clientId) {
  if (!hasSupabase || !clientId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const weekStart = getWeekStartISO();
  const { data, error } = await supabase
    .from('v_client_momentum')
    .select('training_score, nutrition_score, steps_score, sleep_score, checkin_score, total_score')
    .eq('client_id', clientId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function fetchClientSupplements() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('client_supplements')
    .select('id, dosage, timing, supplements(id, name)')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) return [];
  return data ?? [];
}

async function fetchProgressMetrics(clientId) {
  if (!hasSupabase || !clientId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('v_client_progress_metrics')
    .select('weight_change, latest_weight, previous_weight, avg_compliance_last_4w, latest_steps_avg')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

async function fetchProgressTrends(clientId) {
  if (!hasSupabase || !clientId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_client_progress_trends')
    .select('submitted_at, weight, compliance, steps_avg')
    .eq('client_id', clientId)
    .order('submitted_at', { ascending: false })
    .limit(7);
  if (error) return [];
  return (data ?? []).reverse();
}

function formatShortDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

export default function AthleteDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: clientId, isLoading: clientIdLoading } = useQuery({
    queryKey: ['athlete-dashboard-client-id', user?.id],
    queryFn: getMyClientId,
    enabled: !!user?.id && hasSupabase,
  });

  const { data: todayWorkout, isLoading: workoutLoading } = useQuery({
    queryKey: ['athlete-dashboard-workout', clientId],
    queryFn: () => getAssignedWorkoutForToday({ role: 'client', clientId }),
    enabled: !!clientId,
  });

  const { data: momentum, isLoading: momentumLoading } = useQuery({
    queryKey: ['athlete-dashboard-momentum', clientId, getWeekStartISO()],
    queryFn: () => fetchMomentum(clientId),
    enabled: !!clientId && hasSupabase,
  });

  const { data: supplements = [], isLoading: supplementsLoading } = useQuery({
    queryKey: ['athlete-dashboard-supplements'],
    queryFn: fetchClientSupplements,
    enabled: hasSupabase,
  });

  const { data: progressMetrics } = useQuery({
    queryKey: ['athlete-dashboard-metrics', clientId],
    queryFn: () => fetchProgressMetrics(clientId),
    enabled: !!clientId && hasSupabase,
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['athlete-dashboard-trends', clientId],
    queryFn: () => fetchProgressTrends(clientId),
    enabled: !!clientId && hasSupabase,
  });

  const { insights: progressInsights } = React.useMemo(
    () => getAthleteProgressInsights(progressMetrics ?? {}, momentum ?? {}, trends),
    [progressMetrics, momentum, trends]
  );

  const loading = clientIdLoading;
  const hasWorkout = !!todayWorkout?.day && (todayWorkout?.exercises?.length ?? 0) > 0;
  const weightPoints = trends.filter((t) => t.weight != null).map((t) => ({ date: formatShortDate(t.submitted_at), weight: Number(t.weight) }));

  const momentumResult = React.useMemo(() => (momentum ? calculateMomentumScore(momentum) : null), [momentum]);
  const momentumStrongestWeakest = React.useMemo(() => {
    const b = momentumResult?.breakdown;
    if (!b) return { strongest: null, weakest: null };
    const labels = { workouts: 'Workouts', habits: 'Habits', checkins: 'Check-ins', engagement: 'Engagement' };
    const entries = Object.entries(b).filter(([, v]) => v != null && Number.isFinite(v));
    if (entries.length === 0) return { strongest: null, weakest: null };
    const sorted = [...entries].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    return {
      strongest: labels[sorted[0][0]] ?? sorted[0][0],
      weakest: labels[sorted[sorted.length - 1][0]] ?? sorted[sorted.length - 1][0],
    };
  }, [momentumResult?.breakdown]);

  if (!user) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Athlete dashboard" onBack={() => navigate(-1)} />

      <div className="p-4 space-y-4">
        {/* Today workout */}
        <Card style={{ padding: spacing[16], borderLeft: `4px solid ${colors.primary}` }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={20} style={{ color: colors.primary }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                Today&apos;s workout
              </h2>
            </div>
            {hasWorkout && (
              <button
                type="button"
                onClick={() => navigate('/today')}
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: colors.primary }}
              >
                Open <ChevronRight size={14} />
              </button>
            )}
          </div>
          {workoutLoading ? (
            <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
          ) : hasWorkout ? (
            <>
              <p className="text-base font-medium" style={{ color: colors.text }}>
                {todayWorkout.day?.title ?? 'Training day'}
              </p>
              <p className="text-xs mt-1" style={{ color: colors.muted }}>
                {todayWorkout.exercises?.length ?? 0} exercises · {todayWorkout.block?.title ?? 'Program'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/today')}
                className="mt-3 w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                style={{ background: colors.primary, color: '#fff', border: 'none' }}
              >
                <Dumbbell size={16} /> Start workout
              </button>
            </>
          ) : (
            <p className="text-sm" style={{ color: colors.muted }}>
              No workout scheduled for today. Check your program or rest day.
            </p>
          )}
        </Card>

        {/* Habit adherence */}
        {clientId && <HabitAdherenceCard clientId={clientId} />}

        {/* Progress insights */}
        {clientId && progressInsights.length > 0 && (
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} style={{ color: colors.primary }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                Progress insights
              </h2>
              <button
                type="button"
                onClick={() => navigate('/progress')}
                className="ml-auto text-xs font-medium"
                style={{ color: colors.primary }}
              >
                View trends
              </button>
            </div>
            <ul className="space-y-2">
              {progressInsights.map((item) => (
                <li
                  key={item.id}
                  className="text-sm"
                  style={{
                    color: item.level === 'warning' ? colors.danger : item.level === 'positive' ? colors.success : colors.text,
                  }}
                >
                  • {item.text}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Momentum score */}
        {clientId && (
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} style={{ color: colors.primary }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                Momentum score
              </h2>
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="ml-auto text-xs font-medium"
                style={{ color: colors.primary }}
              >
                View details
              </button>
            </div>
            {momentumLoading ? (
              <MomentumCardSkeleton />
            ) : momentum ? (
              <>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold" style={{ color: colors.primary }}>
                    {momentumResult?.total_score ?? (momentum.total_score != null ? Math.round(Number(momentum.total_score)) : '—')}
                  </span>
                  <span className="text-sm" style={{ color: colors.muted }}>/ 100</span>
                </div>
                {momentumResult?.status && (
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{
                    color: momentumResult.status === MOMENTUM_STATUS.ON_TRACK ? colors.success : momentumResult.status === MOMENTUM_STATUS.WATCH ? colors.warning : colors.danger,
                  }}>
                    {momentumResult.status === MOMENTUM_STATUS.ON_TRACK ? 'On track' : momentumResult.status === MOMENTUM_STATUS.WATCH ? 'Watch' : 'Off track'}
                  </p>
                )}
                {(momentumStrongestWeakest.strongest || momentumStrongestWeakest.weakest) && (
                  <p className="text-xs mb-3" style={{ color: colors.muted }}>
                    {momentumStrongestWeakest.strongest && <>Strongest: <strong style={{ color: colors.text }}>{momentumStrongestWeakest.strongest}</strong></>}
                    {momentumStrongestWeakest.strongest && momentumStrongestWeakest.weakest && ' · '}
                    {momentumStrongestWeakest.weakest && <>Focus: <strong style={{ color: colors.text }}>{momentumStrongestWeakest.weakest}</strong></>}
                  </p>
                )}
                <div className="space-y-2">
                  {MOMENTUM_KEYS.slice(0, 3).map(({ key, label, icon: Icon }) => {
                    const val = momentum[key];
                    const num = val != null ? Math.min(100, Math.max(0, Number(val))) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <Icon size={14} style={{ color: colors.muted }} />
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: colors.surface2 }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${num}%`, background: colors.primary }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8" style={{ color: colors.text }}>{num != null ? Math.round(num) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ padding: spacing[12] }}>
                <p className="text-sm font-semibold" style={{ color: colors.text, margin: 0, marginBottom: 4 }}>
                  No momentum data yet
                </p>
                <p className="text-sm" style={{ color: colors.muted, margin: 0 }}>
                  Complete workouts and check-ins this week to see your momentum score.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Nutrition targets */}
        <Card style={{ padding: spacing[16] }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target size={18} style={{ color: colors.primary }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                Nutrition targets
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/nutrition')}
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: colors.primary }}
            >
              View <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-sm mt-2" style={{ color: colors.text }}>
            Calories, protein, carbs and fats are set by your coach. Open Nutrition to log meals and see your plan.
          </p>
        </Card>

        {/* Supplement stack */}
        <Card style={{ padding: spacing[16] }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Pill size={18} style={{ color: colors.primary }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                Supplement stack
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/client/supplements')}
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: colors.primary }}
            >
              {supplements.length > 0 ? 'Log & view all' : 'View'} <ChevronRight size={14} />
            </button>
          </div>
          {supplementsLoading ? (
            <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
          ) : supplements.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>
              No supplements assigned. Your coach can add your stack from their dashboard.
            </p>
          ) : (
            <ul className="space-y-2">
              {supplements.map((row) => (
                <li key={row.id} className="text-sm flex justify-between gap-2" style={{ color: colors.text }}>
                  <span>{row.supplements?.name ?? 'Supplement'}</span>
                  <span className="text-xs shrink-0" style={{ color: colors.muted }}>{row.dosage ?? ''} {row.timing ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Progress trends */}
        {clientId && (
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Activity size={18} style={{ color: colors.primary }} />
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                  Progress trends
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/progress')}
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: colors.primary }}
              >
                Full trends <ChevronRight size={14} />
              </button>
            </div>
            {trendsLoading ? (
              <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
            ) : weightPoints.length >= 2 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Weight (recent check-ins)</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" style={{ color: colors.text }}>
                  {weightPoints.slice(-5).map((p, i) => (
                    <span key={i}>{p.date}: <strong>{p.weight} kg</strong></span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: colors.muted }}>
                Submit check-ins to see weight and compliance trends over time.
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
