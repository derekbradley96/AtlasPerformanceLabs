import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, shell } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { analyseEatingPatterns } from '@/lib/foodPatternAnalysis';
import { getPersonalCalorieProgressPercent, getPersonalProteinProgressPercent } from '@/lib/personalNutritionProfile';

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function buildWeekDayCells(userId, merged, anchorDate = new Date()) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const p = merged && userId ? getPersonalProteinProgressPercent(userId, key, merged) : null;
    const c = merged && userId ? getPersonalCalorieProgressPercent(userId, key, merged) : null;
    const parts = [p, c].filter((x) => x != null && Number.isFinite(Number(x)));
    const avg = parts.length ? parts.reduce((a, b) => a + Number(b), 0) / parts.length : null;
    let tone = 'empty';
    if (avg != null) {
      if (avg >= 80) tone = 'green';
      else if (avg >= 70) tone = 'amber';
      else tone = 'red';
    }
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      tone,
      pct: avg,
    });
  }
  return days;
}

export default function PersonalFoodPatternsSection({ userId, mergedNutrition }) {
  const navigate = useNavigate();

  const { data: distinctDays = 0 } = useQuery({
    queryKey: ['food-patterns-day-count', userId],
    queryFn: async () => {
      if (!hasSupabase || !userId) return 0;
      const sb = getSupabase();
      if (!sb) return 0;
      const start = new Date();
      start.setDate(start.getDate() - 28);
      const startStr = start.toISOString().slice(0, 10);
      const { data, error } = await sb.from('meal_logs').select('log_date').eq('profile_id', userId).gte('log_date', startStr);
      if (error || !Array.isArray(data)) return 0;
      return new Set(data.map((r) => String(r.log_date).slice(0, 10))).size;
    },
    enabled: Boolean(hasSupabase && userId),
    staleTime: STALE_MS,
  });

  const { data: analysis } = useQuery({
    queryKey: ['food-patterns-analysis', userId],
    queryFn: () => analyseEatingPatterns({ supabase: getSupabase(), profileId: userId }),
    enabled: Boolean(hasSupabase && userId && distinctDays >= 14),
    staleTime: STALE_MS,
  });

  const weekCells = useMemo(
    () => buildWeekDayCells(userId, mergedNutrition),
    [userId, mergedNutrition],
  );

  if (distinctDays < 14 || !analysis) return null;

  return (
    <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}`, marginTop: spacing[12] }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Your patterns
      </p>
      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, fontWeight: 700, color: colors.text }}>Atlas has noticed:</p>
      <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>{analysis.insight}</p>
      <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 12, fontWeight: 600, color: colors.text }}>This week (macro hit)</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing[6], marginTop: spacing[8] }}>
        {weekCells.map((day) => {
          const bg =
            day.tone === 'green'
              ? colors.success
              : day.tone === 'amber'
                ? colors.warning
                : day.tone === 'red'
                  ? colors.danger
                  : colors.surface2;
          return (
            <div key={day.key} style={{ flex: 1, textAlign: 'center' }}>
              <div
                title={day.pct != null ? `${Math.round(day.pct)}%` : 'No data'}
                style={{
                  height: 36,
                  borderRadius: 10,
                  background: bg,
                  border: `1px solid ${colors.border}`,
                  opacity: day.tone === 'empty' ? 0.45 : 1,
                }}
              />
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 10, color: colors.muted }}>{day.label}</p>
            </div>
          );
        })}
      </div>
      {analysis.mostEatenFoods?.length ? (
        <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 13, color: colors.text }}>
          Your most eaten foods:{' '}
          <span style={{ fontWeight: 700 }}>{analysis.mostEatenFoods.join(', ')}</span>
        </p>
      ) : null}
      <Button type="button" variant="outline" style={{ marginTop: spacing[12], width: '100%' }} onClick={() => navigate('/nutrition?openForm=1')}>
        Pre-fill from your recent foods any time
      </Button>
    </Card>
  );
}
