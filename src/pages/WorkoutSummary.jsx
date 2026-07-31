import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Clock3, Dumbbell, TrendingUp, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabaseClient';
import { getSetsForSession, getPreviousExercisePerformance } from '@/lib/workoutSessionApi';
import { buildNextSessionLoadPreviewLines } from '@/lib/programProgression';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { sharePlainText } from '@/lib/nativeShare';
import { fetchMergedPersonalNutritionTargets } from '@/lib/personalNutritionProfile';
import { PageLoader } from '@/components/ui/LoadingState';
import { colors, spacing } from '@/ui/tokens';

function goalMessage(goalRaw = '') {
  const goal = String(goalRaw || '').toLowerCase();
  if (goal.includes('build')) return 'Great session. This kind of consistency compounds into muscle gain.';
  if (goal.includes('fat') || goal.includes('cut')) return 'Great session. You are stacking the work that drives fat loss.';
  if (goal.includes('prep') || goal.includes('competition')) return 'Great session. Precision and consistency keep prep on track.';
  return 'Great session. Keep this rhythm going this week.';
}

export default function WorkoutSummary() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const sessionId = search.get('sessionId') || search.get('id');
  const goal = search.get('goal') || '';

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['workout-summary-session', sessionId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !sessionId) return null;
      const { data, error } = await supabase.from('workout_sessions').select('*').eq('id', sessionId).maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: !!sessionId,
  });

  const { data: sets = [], isLoading: setsLoading } = useQuery({
    queryKey: ['workout-summary-sets', sessionId],
    queryFn: () => getSetsForSession(sessionId),
    enabled: !!sessionId,
  });

  const { data: sessionExercises = [] } = useQuery({
    queryKey: ['workout-summary-exercises', session?.program_day_id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !session?.program_day_id) return [];
      const { data } = await supabase
        .from('program_exercises')
        .select('id, name, exercise_name')
        .eq('day_id', session.program_day_id)
        .order('sort_order', { ascending: true });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session?.program_day_id,
  });
  const { data: exerciseNotes = [] } = useQuery({
    queryKey: ['workout-summary-exercise-notes', sessionId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !sessionId) return [];
      const { data } = await supabase
        .from('workout_exercise_notes')
        .select('id, note, exercise_id, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!sessionId,
  });

  const { data: historicalSets = [] } = useQuery({
    queryKey: ['workout-summary-history', session?.client_id, session?.profile_id, sessionId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !sessionId) return [];
      const profileField = session?.client_id ? 'client_id' : 'profile_id';
      const ownerValue = session?.client_id || session?.profile_id;
      if (!profileField || !ownerValue) return [];
      const { data: priorSessions } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq(profileField, ownerValue)
        .eq('status', 'completed')
        .neq('id', sessionId);
      const ids = Array.isArray(priorSessions) ? priorSessions.map((s) => s.id).filter(Boolean) : [];
      if (!ids.length) return [];
      const { data } = await supabase
        .from('workout_session_sets')
        .select('exercise_id, reps_done, weight_done')
        .in('session_id', ids)
        .eq('completed', true);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!sessionId && !!(session?.client_id || session?.profile_id),
  });
  const { data: nutritionTargets } = useQuery({
    queryKey: ['workout-summary-nutrition-targets', session?.profile_id, session?.client_id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      if (session?.profile_id) {
        return fetchMergedPersonalNutritionTargets(session.profile_id);
      }
      if (session?.client_id) {
        const { data } = await supabase
          .from('client_nutrition_plans')
          .select('protein_g, calories')
          .eq('client_id', session.client_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data ?? null;
      }
      return null;
    },
    enabled: Boolean(session?.profile_id || session?.client_id),
  });
  const { data: todayMeals = [] } = useQuery({
    queryKey: ['workout-summary-today-meals', session?.profile_id, session?.client_id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase.from('meal_logs').select('protein_g, calories').eq('log_date', today);
      if (session?.profile_id) q = q.eq('profile_id', session.profile_id);
      else if (session?.client_id) q = q.eq('client_id', session.client_id);
      const { data } = await q;
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(session?.profile_id || session?.client_id),
  });

  const exerciseNameById = useMemo(() => {
    const map = new Map();
    for (const ex of sessionExercises) {
      map.set(ex.id, ex?.name || ex?.exercise_name || 'Exercise');
    }
    return map;
  }, [sessionExercises]);
  const exerciseIdsKey = useMemo(() => sessionExercises.map((e) => e.id).join(','), [sessionExercises]);

  const completedSets = useMemo(() => sets.filter((s) => s?.completed), [sets]);
  const setsProgressKey = useMemo(
    () => completedSets.map((s) => `${s.exercise_id}-${s.set_number}-${s.weight_done}-${s.reps_done}`).join('|'),
    [completedSets],
  );

  const { data: nextSessionLoadLines = [] } = useQuery({
    queryKey: ['workout-summary-next-session-loads', sessionId, setsProgressKey, exerciseIdsKey],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !sessionId || !session) return [];
      if (!completedSets.length) return [];
      return buildNextSessionLoadPreviewLines({
        supabase: sb,
        session,
        sets: completedSets,
        exerciseNameById,
      });
    },
    enabled: Boolean(sessionId && session && completedSets.length > 0),
  });
  const totalVolume = useMemo(
    () => completedSets.reduce((sum, s) => sum + (Number(s.weight_done) || 0) * (Number(s.reps_done) || 0), 0),
    [completedSets]
  );
  const prescribedVsActual = useMemo(() => {
    const grouped = new Map();
    for (const s of completedSets) {
      if (!s?.exercise_id) continue;
      const row = grouped.get(s.exercise_id) || {
        exerciseId: s.exercise_id,
        name: exerciseNameById.get(s.exercise_id) || 'Exercise',
        sets: 0,
        prescribedReps: 0,
        prescribedWeight: 0,
        actualReps: 0,
        actualWeight: 0,
      };
      row.sets += 1;
      row.prescribedReps += Number(s.prescribed_reps) || 0;
      row.prescribedWeight += Number(s.prescribed_weight) || 0;
      row.actualReps += Number(s.reps_done) || 0;
      row.actualWeight += Number(s.weight_done) || 0;
      grouped.set(s.exercise_id, row);
    }
    return Array.from(grouped.values());
  }, [completedSets, exerciseNameById]);

  const prs = useMemo(() => {
    const bestByExercise = new Map();
    for (const row of historicalSets) {
      const score = (Number(row.weight_done) || 0) * (Number(row.reps_done) || 0);
      const prev = bestByExercise.get(row.exercise_id) || 0;
      if (score > prev) bestByExercise.set(row.exercise_id, score);
    }
    const records = [];
    const currentBest = new Map();
    for (const row of completedSets) {
      const score = (Number(row.weight_done) || 0) * (Number(row.reps_done) || 0);
      const prev = currentBest.get(row.exercise_id) || 0;
      if (score > prev) currentBest.set(row.exercise_id, score);
    }
    for (const [exerciseId, score] of currentBest.entries()) {
      const prevBest = bestByExercise.get(exerciseId) || 0;
      if (score > prevBest) {
        records.push({
          exerciseId,
          score,
          prevBest,
          name: exerciseNameById.get(exerciseId) || 'Exercise',
        });
      }
    }
    return records;
  }, [historicalSets, completedSets, exerciseNameById]);

  const prSignature = prs.map((p) => `${p.exerciseId}:${Math.round(p.score)}`).join('|');

  const { data: prShareHeadline } = useQuery({
    queryKey: ['workout-summary-pr-headline', sessionId, prSignature],
    queryFn: async () => {
      if (!sessionId || !session || prs.length === 0) return null;
      const top = prs[0];
      const prevMap = await getPreviousExercisePerformance({
        clientId: session.client_id || null,
        profileId: session.profile_id || null,
        exerciseId: top.exerciseId,
        excludeSessionId: sessionId,
      });
      const setsThis = completedSets.filter((s) => s.exercise_id === top.exerciseId && s.completed);
      const maxW = Math.max(0, ...setsThis.map((s) => Number(s.weight_done) || 0));
      let prevBestW = 0;
      if (prevMap && typeof prevMap === 'object') {
        for (const v of Object.values(prevMap)) {
          prevBestW = Math.max(prevBestW, Number(v?.weight_done) || 0);
        }
      }
      if (maxW > 0 && maxW > prevBestW) {
        return `${Math.round(maxW)}kg on ${top.name}`;
      }
      return `${Math.round(top.score).toLocaleString()} training volume on ${top.name}`;
    },
    enabled: Boolean(sessionId && session && prs.length > 0),
  });

  const { data: coachShare } = useQuery({
    queryKey: ['workout-summary-coach-ref', session?.client_id],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !session?.client_id) return null;
      const { data: c } = await sb.from('clients').select('coach_id, trainer_id').eq('id', session.client_id).maybeSingle();
      const cid = c?.coach_id || c?.trainer_id;
      if (!cid) return null;
      const { data: p } = await sb.from('profiles').select('referral_code, display_name, full_name').eq('id', cid).maybeSingle();
      const code = (p?.referral_code || '').trim();
      const name = (p?.display_name || p?.full_name || 'Your coach').trim();
      const link = getCoachClientJoinLinkPrimary(code, cid);
      if (!link) return null;
      return { coachName: name, signupLink: link };
    },
    enabled: Boolean(session?.client_id),
  });
  const durationMin = Math.max(1, Math.round((new Date(session?.completed_at || Date.now()).getTime() - new Date(session?.started_at || Date.now()).getTime()) / 60000));
  const estimatedBurnKcal = Math.round(durationMin * 7);
  const proteinTarget = Number(
    nutritionTargets?.protein_g ??
      nutritionTargets?.target_protein_g ??
      0
  );
  const proteinHit = Math.round((todayMeals || []).reduce((sum, row) => sum + (Number(row?.protein_g) || 0), 0));

  if (!sessionId || sessionLoading || setsLoading) return <PageLoader message="Loading summary..." />;
  if (!session) {
    navigate('/today');
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, padding: spacing[16], paddingBottom: spacing[24] }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 24, color: colors.text }}>Workout complete</h1>
        <p style={{ margin: `${spacing[8]}px 0 0`, color: colors.muted }}>{goalMessage(goal)}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing[10], marginTop: spacing[14] }}>
          <div style={cardStyle}>
            <Clock3 size={16} color={colors.primary} />
            <p style={valueStyle}>{durationMin} min</p>
            <p style={labelStyle}>Duration</p>
          </div>
          <div style={cardStyle}>
            <TrendingUp size={16} color={colors.primary} />
            <p style={valueStyle}>{Math.round(totalVolume).toLocaleString()} kg</p>
            <p style={labelStyle}>Total volume lifted</p>
          </div>
          <div style={cardStyle}>
            <Dumbbell size={16} color={colors.primary} />
            <p style={valueStyle}>{completedSets.length}</p>
            <p style={labelStyle}>Completed sets</p>
          </div>
          <div style={cardStyle}>
            <Trophy size={16} color={colors.primary} />
            <p style={valueStyle}>{prs.length}</p>
            <p style={labelStyle}>Personal records</p>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: spacing[12] }}>
          <p style={{ ...labelStyle, marginBottom: spacing[6] }}>Personal records broken</p>
          {prs.length === 0 ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No PRs this session. Keep stacking quality reps.</p>
          ) : (
            prs.map((pr) => (
              <p key={pr.exerciseId} style={{ margin: `0 0 ${spacing[4]}px`, color: colors.text, fontSize: 14 }}>
                {pr.name}: {Math.round(pr.score).toLocaleString()} volume (prev best {Math.round(pr.prevBest).toLocaleString()})
              </p>
            ))
          )}
        </div>

        {prs.length > 0 && coachShare?.signupLink ? (
          <div
            style={{
              ...cardStyle,
              marginTop: spacing[12],
              border: `1px solid ${colors.primary}55`,
              background: colors.primarySubtle,
            }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.text }}>New PR!</p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
              {prShareHeadline ? `You hit ${prShareHeadline}.` : 'You set a new personal best this session.'}
            </p>
            <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 12, fontWeight: 700, color: colors.text }}>Share your achievement</p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
              Know someone who wants results like this? Your coach {coachShare.coachName} has space for new clients.
            </p>
            <button
              type="button"
              onClick={async () => {
                const line = prShareHeadline || `${prs[0].name} — new session best`;
                const text = `Hit a new PR today — ${line} with Atlas Performance Labs. ${coachShare.signupLink}`;
                const ok = await sharePlainText(text, 'Share your PR');
                if (!ok) toast.error('Could not open share sheet');
              }}
              style={{
                marginTop: spacing[10],
                width: '100%',
                minHeight: 46,
                borderRadius: 10,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Share2 size={18} />
              Share post
            </button>
          </div>
        ) : null}

        {nextSessionLoadLines.length > 0 ? (
          <div style={{ ...cardStyle, marginTop: spacing[12], border: `1px solid ${colors.primary}44`, background: colors.primarySubtle }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.text }}>Next session preview</p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              Based on today&apos;s performance, here is how Atlas is nudging load for next time:
            </p>
            <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 18, fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
              {nextSessionLoadLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {prescribedVsActual.length > 0 ? (
          <div style={{ ...cardStyle, marginTop: spacing[12] }}>
            <p style={{ ...labelStyle, marginBottom: spacing[6] }}>Prescribed vs actual</p>
            {prescribedVsActual.map((r) => {
              const avgPrescribedW = r.sets > 0 ? r.prescribedWeight / r.sets : 0;
              const avgActualW = r.sets > 0 ? r.actualWeight / r.sets : 0;
              const avgPrescribedReps = r.sets > 0 ? r.prescribedReps / r.sets : 0;
              const avgActualReps = r.sets > 0 ? r.actualReps / r.sets : 0;
              const deltaWeight = avgActualW - avgPrescribedW;
              const deltaReps = avgActualReps - avgPrescribedReps;
              return (
                <div key={`sum-${r.exerciseId}`} style={{ padding: `${spacing[8]}px 0`, borderTop: `1px solid ${colors.border}` }}>
                  <p style={{ margin: 0, color: colors.text, fontSize: 14, fontWeight: 700 }}>{r.name}</p>
                  <p style={{ margin: `${spacing[4]}px 0 0`, color: colors.muted, fontSize: 12 }}>
                    Prescribed {r.sets}x{Math.round(avgPrescribedReps)}@{Math.round(avgPrescribedW * 10) / 10}kg · Actual {r.sets}x{Math.round(avgActualReps)}@{Math.round(avgActualW * 10) / 10}kg · Delta {deltaWeight >= 0 ? '+' : ''}{Math.round(deltaWeight * 10) / 10}kg / {deltaReps >= 0 ? '+' : ''}{Math.round(deltaReps)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

        {(session?.readiness_sleep != null || session?.readiness_energy != null || session?.readiness_soreness != null) ? (
          <div style={{ ...cardStyle, marginTop: spacing[12], border: `1px solid ${colors.border}` }}>
            <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: 700 }}>
              Readiness recap: Sleep {session?.readiness_sleep ?? '—'}/5 · Energy {session?.readiness_energy ?? '—'}/5 · Soreness {session?.readiness_soreness ?? '—'}/5
            </p>
            {(Number(session?.readiness_sleep) <= 3 && Number(session?.readiness_energy) <= 3 && Number(session?.readiness_soreness) <= 3) ? (
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.warning }}>
                {session?.client_id
                  ? 'Low readiness today - the coach can see this alongside your performance.'
                  : 'Low readiness today — no shame in going lighter.'}
              </p>
            ) : null}
          </div>
        ) : null}

        {exerciseNotes.length > 0 ? (
          <div style={{ ...cardStyle, marginTop: spacing[12] }}>
            <p style={{ ...labelStyle, marginBottom: spacing[6] }}>Your session notes</p>
            {exerciseNotes.map((n) => (
              <blockquote key={n.id} style={{ margin: `${spacing[6]}px 0 0`, paddingLeft: spacing[10], borderLeft: `3px solid ${colors.border}`, color: colors.text }}>
                {n.note}
              </blockquote>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => navigate('/today')}
          style={{ marginTop: spacing[14], width: '100%', minHeight: 48, borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700 }}
        >
          Back to Today
        </button>
        <div style={{ ...cardStyle, marginTop: spacing[10], border: `1px solid ${colors.primary}66`, background: colors.primarySubtle }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: 700 }}>What&apos;s next?</p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            Next: log your meals. You burned ~{estimatedBurnKcal} kcal — your protein target for today is {proteinTarget || 'set in Log'} and you&apos;ve hit {proteinHit}g.
          </p>
          <button
            type="button"
            onClick={() => navigate('/nutrition?meal_type=post_workout&openForm=1')}
            style={{ marginTop: spacing[8], minHeight: 42, borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, padding: '0 12px' }}
          >
            Log post-workout meal
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  background: colors.surface1,
  padding: spacing[12],
};

const valueStyle = { margin: `${spacing[6]}px 0 0`, fontSize: 20, color: colors.text, fontWeight: 700 };
const labelStyle = { margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted };