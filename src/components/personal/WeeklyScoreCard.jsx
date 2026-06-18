import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { calculateWeeklyScore, getIsoWeekKey, weeklyScoreDismissStorageKey } from '@/lib/weeklyEffortScore';
import { fetchPersonalProgressDashboard } from '@/lib/personalProgressDashboard';
import { getPersonalCalorieProgressPercent, getPersonalProteinProgressPercent } from '@/lib/personalNutritionProfile';

function Bar({ label, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: spacing[8] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.muted, marginBottom: 4 }}>
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: colors.surface2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colors.primary, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export default function WeeklyScoreCard({ userId, mergedNutrition }) {
  const navigate = useNavigate();
  const weekKey = useMemo(() => getIsoWeekKey(), []);
  const [hidden, setHidden] = useState(false);

  const dismissed =
    hidden
    || (typeof window !== 'undefined'
      && window.localStorage?.getItem(weeklyScoreDismissStorageKey(userId, weekKey)) === '1');

  const { data: dash } = useQuery({
    queryKey: ['personal-progress-dashboard', userId],
    queryFn: () => fetchPersonalProgressDashboard(userId),
    enabled: Boolean(hasSupabase && userId),
  });

  const { data: sleepAvg1to5 } = useQuery({
    queryKey: ['weekly-score-sleep-avg', userId],
    queryFn: async () => {
      if (!hasSupabase || !userId) return null;
      const sb = getSupabase();
      if (!sb) return null;
      const { data } = await sb
        .from('personal_checkins')
        .select('sleep')
        .eq('user_id', userId)
        .not('sleep', 'is', null)
        .order('created_at', { ascending: false })
        .limit(14);
      const rows = Array.isArray(data) ? data.map((r) => Number(r.sleep)).filter((n) => Number.isFinite(n) && n > 0) : [];
      if (!rows.length) return null;
      return rows.reduce((a, b) => a + b, 0) / rows.length;
    },
    enabled: Boolean(hasSupabase && userId),
  });

  const score = useMemo(() => {
    const anchor = new Date();
    const keys = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    let nutritionHits = 0;
    if (mergedNutrition && userId) {
      for (const day of keys) {
        const p = getPersonalProteinProgressPercent(userId, day, mergedNutrition);
        const c = getPersonalCalorieProgressPercent(userId, day, mergedNutrition);
        const parts = [p, c].filter((x) => x != null && Number.isFinite(Number(x)));
        if (!parts.length) continue;
        const avg = parts.reduce((a, b) => a + Number(b), 0) / parts.length;
        if (avg >= 80) nutritionHits += 1;
      }
    }
    const sleepHours =
      sleepAvg1to5 != null ? (Number(sleepAvg1to5) / 5) * 3.5 + 6 : 7;

    return calculateWeeklyScore({
      workoutsCompleted: Number(dash?.weeklyWorkoutDone) || 0,
      workoutsPlanned: Math.max(1, Number(dash?.weeklyWorkoutTarget) || 4),
      nutritionDaysHit: nutritionHits,
      totalDays: 7,
      avgSleepHours: sleepHours,
      stepsDailyAvg: 0,
      stepsTarget: 0,
    });
  }, [dash, mergedNutrition, userId, sleepAvg1to5]);

  if (dismissed || !userId) return null;

  const onDismiss = () => {
    try {
      window.localStorage.setItem(weeklyScoreDismissStorageKey(userId, weekKey), '1');
    } catch {}
    setHidden(true);
  };

  return (
    <Card style={{ padding: spacing[14], border: `1px solid ${colors.primary}55`, background: colors.primarySubtle }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[10] }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            This week&apos;s effort
          </p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 36, fontWeight: 800, color: colors.text }}>
            {score.total}
            <span style={{ fontSize: 16, fontWeight: 600, color: colors.muted }}>/99</span>
          </p>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 600, color: colors.text }}>Grade: {score.grade}</p>
        </div>
        <Button type="button" variant="outline" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <div style={{ marginTop: spacing[12] }}>
        <Bar label="Training" value={score.trainingBar10} max={10} />
        <Bar label="Nutrition" value={score.nutritionBar10} max={10} />
        <Bar label="Recovery" value={score.recoveryBar10} max={10} />
      </div>
      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, fontWeight: 700, color: colors.text }}>Focus for next week</p>
      <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
        {score.focusArea.area} — {score.focusArea.tip}
      </p>
      <Button type="button" style={{ marginTop: spacing[12] }} onClick={() => navigate('/progress')}>
        See full week
      </Button>
    </Card>
  );
}
