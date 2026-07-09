import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

export function calculateAthleteDevScore({
  momentumScores,
  checkinsSubmitted,
  workoutsCompleted,
  daysAsAthlete,
  peakMomentum,
}) {
  const rows = Array.isArray(momentumScores) ? momentumScores : [];
  const recentWeeks = rows.slice(0, 4);
  const baseScore = recentWeeks.length > 0
    ? recentWeeks.reduce((s, w) => s + (Number(w?.overall) || 0), 0) / recentWeeks.length
    : 0;

  const consistencyWeeks = rows.filter((w) => (Number(w?.overall) || 0) >= 60).length;
  const consistencyBonus = Math.min(20, consistencyWeeks * 2);
  const longevityBonus = Math.min(10, Math.floor((Number(daysAsAthlete) || 0) / 30));

  // Small earned bonus to keep long-term completion meaningful.
  const completionSignal = Math.min(
    8,
    Math.floor((Number(workoutsCompleted || 0) / 20) + (Number(checkinsSubmitted || 0) / 10))
  );
  const peakBonus = Math.min(4, Math.floor((Number(peakMomentum || 0) / 100) * 4));

  const raw = baseScore + consistencyBonus + longevityBonus + completionSignal + peakBonus;
  return Math.round(Math.min(1000, Math.max(0, (raw / 130) * 1000)));
}

export function getADSLabel(score) {
  const n = Number(score) || 0;
  if (n >= 900) return 'Elite';
  if (n >= 750) return 'Advanced';
  if (n >= 600) return 'Developing';
  if (n >= 400) return 'Building';
  return 'Starting out';
}

export function getADSInterpretation(score, changeVs4WeeksAgo) {
  const label = getADSLabel(score);
  const delta = Number(changeVs4WeeksAgo) || 0;
  if (delta > 50) {
    return `Your development score is ${score} (${label}) — up ${delta} points in the last 4 weeks. Strong momentum building.`;
  }
  if (delta < -30) {
    return `Your development score is ${score} (${label}) — down from your recent peak. Consistency this week will reverse it.`;
  }
  return `Your development score is ${score} (${label}). ${score >= 600 ? 'Consistent work is paying off.' : 'Each session adds to your score.'}`;
}

function toMomentumRow(row) {
  const overall = Number(row?.total_score ?? row?.overall ?? 0) || 0;
  return { overall, week_start: row?.week_start || null };
}

export async function computeAthleteDevelopmentForProfile({ profileId, clientId }) {
  try {
    if (!hasSupabase || !profileId) return null;
    const sb = getSupabase();
    if (!sb) return null;

    const [profileRes, momentumRes, checkinsRes, workoutsRes] = await Promise.all([
      sb.from('profiles').select('id, created_at, athlete_dev_score').eq('id', profileId).maybeSingle(),
      clientId
        ? sb
            .from('v_client_momentum')
            .select('week_start, total_score')
            .eq('client_id', clientId)
            .order('week_start', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] }),
      // Personal users have no clients-row id — their check-ins and sessions are
      // keyed by profile_id/user_id. The old client_id-only branch made both
      // counts fall through to 0, pinning every personal user's dev score at 0
      // (Progress stuck on "Complete your first workout" after real sessions).
      clientId
        ? sb.from('checkins').select('id', { head: true, count: 'exact' }).eq('client_id', clientId)
        : sb.from('personal_checkins').select('id', { head: true, count: 'exact' }).eq('user_id', profileId),
      clientId
        ? sb.from('workout_sessions').select('id', { head: true, count: 'exact' }).eq('client_id', clientId).eq('status', 'completed')
        : sb.from('workout_sessions').select('id', { head: true, count: 'exact' }).eq('profile_id', profileId).eq('status', 'completed'),
    ]);

    const createdAt = profileRes?.data?.created_at ? new Date(profileRes.data.created_at) : null;
    const now = new Date();
    const daysAsAthlete = createdAt && Number.isFinite(createdAt.getTime())
      ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86400000))
      : 0;
    const momentumRows = (Array.isArray(momentumRes?.data) ? momentumRes.data : []).map(toMomentumRow);
    const peakMomentum = momentumRows.reduce((mx, row) => Math.max(mx, Number(row.overall) || 0), 0);
    const score = calculateAthleteDevScore({
      momentumScores: momentumRows,
      checkinsSubmitted: Number(checkinsRes?.count) || 0,
      workoutsCompleted: Number(workoutsRes?.count) || 0,
      daysAsAthlete,
      peakMomentum,
    });
    const score4WeeksAgo = calculateAthleteDevScore({
      momentumScores: momentumRows.slice(4),
      checkinsSubmitted: Number(checkinsRes?.count) || 0,
      workoutsCompleted: Number(workoutsRes?.count) || 0,
      daysAsAthlete,
      peakMomentum,
    });
    const delta4 = score - score4WeeksAgo;
    return {
      score,
      delta4,
      label: getADSLabel(score),
      interpretation: getADSInterpretation(score, delta4),
      trend: momentumRows.slice().reverse().map((r) => ({
        week: r.week_start ? String(r.week_start).slice(5, 10) : 'wk',
        overall: Number(r.overall) || 0,
      })),
    };
  } catch (error) {
    console.error('[athleteDevelopmentScore] computeAthleteDevelopmentForProfile:', error);
    return null;
  }
}

export async function syncAthleteDevelopmentScore({ profileId, clientId }) {
  try {
    const result = await computeAthleteDevelopmentForProfile({ profileId, clientId });
    if (!result || !hasSupabase || !profileId) return result;
    const sb = getSupabase();
    if (!sb) return result;
    await sb
      .from('profiles')
      .update({
        athlete_dev_score: result.score,
        athlete_dev_score_updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);
    return result;
  } catch (error) {
    console.error('[athleteDevelopmentScore] syncAthleteDevelopmentScore:', error);
    return null;
  }
}
