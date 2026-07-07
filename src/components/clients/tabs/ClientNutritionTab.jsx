import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { spacing, colors, radii } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getLocalDateKey } from '@/lib/localDate';
import { ChevronDown, ChevronUp, History } from 'lucide-react';

export default function ClientNutritionTab({
  nutritionLatestWeek,
  nutritionLoading = false,
  nutritionError = null,
  onRetryNutrition,
  osPrepRow,
  handleApplyOsAdjustment,
  clientDailySnapshotLoading,
  clientTodayLines,
  clientId,
  clientUserId,
  navigate,
}) {
  const { data: clientMealsToday = [], isLoading: clientMealsTodayLoading } = useQuery({
    queryKey: ['client-meals-today', clientId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !clientId) return [];
      const today = getLocalDateKey();
      const { data } = await supabase
        .from('meal_logs')
        .select('id, food_name, calories, protein_g, carbs_g, fats_g, meal_type, logged_at')
        .eq('client_id', clientId)
        .eq('log_date', today)
        .order('logged_at', { ascending: true });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(clientId && hasSupabase),
    staleTime: 60000,
  });

  const todayTotals = useMemo(
    () => ({
      calories: clientMealsToday.reduce((s, m) => s + (Number(m?.calories) || 0), 0),
      protein: clientMealsToday.reduce((s, m) => s + (Number(m?.protein_g) || 0), 0),
      carbs: clientMealsToday.reduce((s, m) => s + (Number(m?.carbs_g) || 0), 0),
      fats: clientMealsToday.reduce((s, m) => s + (Number(m?.fats_g) || 0), 0),
    }),
    [clientMealsToday]
  );
  const caloriesTarget = nutritionLatestWeek?.calories ?? null;
  const proteinTarget = nutritionLatestWeek?.protein ?? null;

  const [historyExpanded, setHistoryExpanded] = useState(false);

  const { data: personalHistory = [], isLoading: personalHistoryLoading } = useQuery({
    queryKey: ['client-personal-nutrition-history', clientUserId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !clientUserId) return [];
      const { data } = await supabase
        .from('personal_nutrition_adherence')
        .select('day_date, target_calories, target_protein_g, logged_calories, logged_protein_g, macros_hit_percent')
        .eq('profile_id', clientUserId)
        .order('day_date', { ascending: false })
        .limit(30);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(clientUserId && hasSupabase),
    staleTime: 300000,
  });

  return (
    <>
      <p style={{ ...sectionLabel }}>Current plan targets</p>
      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        {nutritionLoading ? (
          <SkeletonCard lines={4} />
        ) : nutritionError && !nutritionLatestWeek ? (
          <>
            <p className="text-sm font-medium" style={{ color: colors.text }}>Could not load nutrition plan</p>
            <Button variant="secondary" size="sm" style={{ marginTop: spacing[12] }} onClick={onRetryNutrition}>
              Retry
            </Button>
          </>
        ) : !nutritionLatestWeek ? (
          <>
            <p className="text-sm" style={{ color: colors.muted }}>No nutrition plan set yet</p>
            <Button variant="secondary" size="sm" style={{ marginTop: spacing[12] }} onClick={() => navigate(`/nutrition-builder?clientId=${clientId}`)}>
              Set up nutrition plan
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Macros</p>
                <p style={{ color: colors.text }}>
                  {[
                    nutritionLatestWeek.calories != null ? `${nutritionLatestWeek.calories} cal` : null,
                    nutritionLatestWeek.protein != null ? `P ${nutritionLatestWeek.protein}g` : null,
                    nutritionLatestWeek.carbs != null ? `C ${nutritionLatestWeek.carbs}g` : null,
                    nutritionLatestWeek.fats != null ? `F ${nutritionLatestWeek.fats}g` : null,
                  ].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Water target</p>
                <p style={{ color: colors.text }}>{osPrepRow?.water_target_ml != null ? `${osPrepRow.water_target_ml} ml` : '—'}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" style={{ marginTop: spacing[12] }} onClick={handleApplyOsAdjustment}>
              Edit macros & targets
            </Button>
          </>
        )}
      </Card>

      <p style={{ ...sectionLabel }}>Today snapshot</p>
      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        {clientDailySnapshotLoading ? (
          <SkeletonCard lines={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Workout</p><p style={{ color: colors.text }}>{clientTodayLines?.workout ?? '—'}</p></div>
              <div><p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Food</p><p style={{ color: colors.text }}>{clientTodayLines?.food ?? '—'}</p></div>
            </div>
            {clientId ? (
              <>
                {/* Opens coach nutrition editor for this client */}
                <Button variant="ghost" size="sm" className="h-auto p-0 mt-3 -ml-1" onClick={() => navigate(`/clients/${clientId}/nutrition`)}>
                  Open nutrition plan
                </Button>
                <Button variant="ghost" size="sm" className="h-auto p-0 mt-2 -ml-1" onClick={() => navigate(`/nutrition-builder?clientId=${clientId}`)}>
                  Open nutrition builder
                </Button>
              </>
            ) : null}
          </>
        )}
      </Card>
      <p style={{ ...sectionLabel }}>Today&apos;s food diary</p>
      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        {clientMealsTodayLoading ? (
          <SkeletonCard lines={5} />
        ) : clientMealsToday.length === 0 ? (
          <p className="text-sm" style={{ color: colors.muted, margin: 0 }}>No meals logged today</p>
        ) : (
          <>
            {clientMealsToday.map((meal) => (
              <div
                key={meal.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: `${spacing[6]}px 0`,
                  borderBottom: `0.5px solid ${colors.border}`,
                }}
              >
                <div>
                  <span style={{ fontSize: 13, color: colors.text }}>{meal.food_name}</span>
                  <span style={{ fontSize: 11, color: colors.muted, marginLeft: spacing[8] }}>
                    {String(meal.meal_type || '').replace('_', '-')}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, color: colors.text }}>
                    {Math.round(Number(meal.calories) || 0)} kcal
                  </span>
                  <span style={{ fontSize: 11, color: colors.primary, marginLeft: spacing[8] }}>
                    P: {Math.round(Number(meal.protein_g) || 0)}g
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
        <div style={{ marginTop: spacing[12], padding: spacing[12], background: colors.surface1, borderRadius: radii.md }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: colors.muted,
              margin: 0,
              marginBottom: spacing[8],
              textTransform: 'uppercase',
              letterSpacing: '.06em',
            }}
          >
            Today vs targets
          </p>
          {[
            { label: 'Calories', logged: Math.round(todayTotals.calories), target: caloriesTarget, unit: 'kcal' },
            { label: 'Protein', logged: Math.round(todayTotals.protein), target: proteinTarget, unit: 'g' },
          ].map(({ label, logged, target, unit }) => {
            const pct = target ? Math.min(100, (logged / target) * 100) : null;
            const color = !pct ? colors.muted : pct >= 90 ? colors.success : pct >= 70 ? colors.primary : colors.warning;
            return (
              <div key={label} style={{ marginBottom: spacing[6] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[2] }}>
                  <span style={{ fontSize: 12, color: colors.muted }}>{label}</span>
                  <span style={{ fontSize: 12, color }}>
                    {logged}{unit}
                    {target ? ` / ${target}${unit}` : ''}
                  </span>
                </div>
                {target ? (
                  <div style={{ height: 4, background: colors.surface2, borderRadius: 2 }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 2,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          {proteinTarget && todayTotals.protein < proteinTarget * 0.7 ? (
            <p style={{ fontSize: 12, color: colors.warning, marginTop: spacing[8], marginBottom: 0 }}>
              ⚠️ Protein significantly below target — consider addressing in your next message or check-in feedback.
            </p>
          ) : null}
        </div>
      </Card>

      {(personalHistoryLoading || personalHistory.length > 0) && (
        <>
          <button
            type="button"
            onClick={() => setHistoryExpanded((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[6],
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: sectionGap,
              width: '100%',
            }}
          >
            <History size={14} color={colors.primary} />
            <span style={{ ...sectionLabel, margin: 0, flex: 1, textAlign: 'left' }}>Pre-coaching nutrition history</span>
            {historyExpanded ? <ChevronUp size={14} color={colors.muted} /> : <ChevronDown size={14} color={colors.muted} />}
          </button>
          {historyExpanded && (
            <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
              <p style={{ fontSize: 11, color: colors.muted, marginBottom: spacing[12], marginTop: 0 }}>
                This client self-tracked before joining your roster. Last 30 days shown.
              </p>
              {personalHistoryLoading ? (
                <SkeletonCard lines={4} />
              ) : personalHistory.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>No self-tracked nutrition data found.</p>
              ) : (
                <div>
                  {personalHistory.map((row) => {
                    const hitPct = row.macros_hit_percent != null
                      ? Math.round(Number(row.macros_hit_percent))
                      : row.target_calories
                        ? Math.round((Number(row.logged_calories) / Number(row.target_calories)) * 100)
                        : null;
                    const color = hitPct == null ? colors.muted : hitPct >= 90 ? colors.success : hitPct >= 70 ? colors.primary : colors.warning;
                    return (
                      <div
                        key={row.day_date}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: `${spacing[6]}px 0`,
                          borderBottom: `0.5px solid ${colors.border}`,
                        }}
                      >
                        <span style={{ fontSize: 12, color: colors.muted }}>
                          {new Date(row.day_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <span style={{ fontSize: 12, color: colors.text }}>
                          {Math.round(Number(row.logged_calories) || 0)} kcal
                          {row.logged_protein_g != null ? ` · P ${Math.round(Number(row.logged_protein_g))}g` : ''}
                        </span>
                        {hitPct != null && (
                          <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                            {hitPct}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {personalHistory.length > 0 && (() => {
                    const avg = Math.round(
                      personalHistory.reduce((s, r) => s + (Number(r.logged_calories) || 0), 0) / personalHistory.length
                    );
                    const avgP = Math.round(
                      personalHistory.reduce((s, r) => s + (Number(r.logged_protein_g) || 0), 0) / personalHistory.length
                    );
                    return (
                      <div style={{ marginTop: spacing[12], padding: spacing[10], background: colors.surface1, borderRadius: radii.md }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: colors.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: spacing[4] }}>
                          30-day average
                        </p>
                        <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
                          {avg} kcal · P {avgP}g
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
