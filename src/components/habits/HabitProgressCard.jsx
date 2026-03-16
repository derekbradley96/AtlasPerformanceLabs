/**
 * Habit progress card: Steps, Sleep, Water, Nutrition adherence.
 * Uses client_habits + habit_logs. Shown on Client Home and Coach Client Detail.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { Activity, Moon, Droplets, Utensils } from 'lucide-react';
import { getHabitStreak, getHabitAdherence } from '@/lib/habitInsights';

const HABIT_SLOTS = [
  { key: 'steps', label: 'Steps', icon: Activity, unit: '' },
  { key: 'sleep', label: 'Sleep', icon: Moon, unit: 'h' },
  { key: 'water', label: 'Water', icon: Droplets, unit: 'L' },
  { key: 'nutrition_adherence', label: 'Nutrition adherence', icon: Utensils, unit: '%' },
];

function normType(t) {
  const s = (t || '').toLowerCase().trim();
  if (s === 'steps') return 'steps';
  if (s === 'sleep') return 'sleep';
  if (s === 'water') return 'water';
  if (s.startsWith('nutrition')) return 'nutrition_adherence';
  return null;
}

function normName(name) {
  const s = (name || '').toLowerCase();
  if (s.includes('step')) return 'steps';
  if (s.includes('sleep')) return 'sleep';
  if (s.includes('water')) return 'water';
  if (s.includes('nutrition') || s.includes('adherence')) return 'nutrition_adherence';
  return null;
}

export default function HabitProgressCard({ clientId }) {
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['client_habits', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_habits')
        .select('*')
        .eq('client_id', clientId);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits]);
  const habitsBySlot = useMemo(() => {
    const map = {};
    HABIT_SLOTS.forEach((s) => { map[s.key] = null; });
    habits.forEach((h) => {
      const slot = normType(h.habit_type) || normName(h.habit_name);
      if (slot && map[slot] === null) map[slot] = h;
    });
    return map;
  }, [habits]);

  const { data: logs = [] } = useQuery({
    queryKey: ['habit_logs', habitIds],
    queryFn: async () => {
      if (!supabase || habitIds.length === 0) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const from = sevenDaysAgo.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .in('habit_id', habitIds)
        .gte('log_date', from)
        .order('log_date', { ascending: false });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && habitIds.length > 0,
  });

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const latestByHabitId = useMemo(() => {
    const byId = {};
    logs.forEach((log) => {
      if (byId[log.habit_id] == null) byId[log.habit_id] = log;
    });
    return byId;
  }, [logs]);

  if (!clientId) return null;

  if (habitsLoading) {
    return (
      <div style={{ marginBottom: spacing[16] }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Habit progress</p>
        <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
          <div className="animate-pulse flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-white/10" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const hasAnyHabit = habits.length > 0;

  return (
    <div style={{ marginBottom: spacing[16] }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
        Habit progress
      </p>
      <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
        {!hasAnyHabit && (
          <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[12] }}>
            No habits set up yet. Habits will show here when they&apos;re added.
          </p>
        )}
        <div className="grid gap-3">
          {HABIT_SLOTS.map((slot) => {
            const habit = habitsBySlot[slot.key];
            const Icon = slot.icon;
            if (!habit) {
              return (
                <div
                  key={slot.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[12],
                    padding: spacing[8],
                    borderRadius: 8,
                    background: colors.surface2,
                  }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.muted }}>
                    <Icon size={16} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <p className="text-sm font-medium" style={{ color: colors.muted }}>{slot.label}</p>
                    <p className="text-xs" style={{ color: colors.muted }}>—</p>
                  </div>
                </div>
              );
            }
            const latest = latestByHabitId[habit.id];
            const value = latest?.value != null && latest?.value !== '' ? Number(latest.value) : null;
            const target = habit.target_value != null && habit.target_value !== '' ? Number(habit.target_value) : null;
            const pct = target != null && target > 0 && value != null ? Math.min(100, Math.round((value / target) * 100)) : null;
            const displayValue = value != null
              ? `${value}${slot.unit}`
              : '—';
            const habitLogs = logs.filter((l) => l.habit_id === habit.id);
            const streakText = getHabitStreak(habit, habitLogs);
            const adherenceText = getHabitAdherence(habit, habitLogs);
            return (
              <div
                key={slot.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[12],
                  padding: spacing[8],
                  borderRadius: 8,
                  background: colors.surface2,
                }}
              >
                <span style={{ width: 32, height: 32, borderRadius: 8, background: colors.primarySubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary }}>
                  <Icon size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm font-medium" style={{ color: colors.text }}>{slot.label}</p>
                  <p className="text-sm" style={{ color: colors.muted }}>
                    {displayValue}
                    {target != null && target > 0 && (
                      <span className="ml-1">/ {target}{slot.unit}</span>
                    )}
                    {latest?.log_date === todayStr && (
                      <span className="text-xs ml-1" style={{ color: colors.primary }}>Today</span>
                    )}
                  </p>
                  {pct != null && (
                    <div
                      style={{
                        marginTop: 4,
                        height: 4,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          height: '100%',
                          background: pct >= 100 ? colors.success : colors.primary,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  )}
                  {(streakText || adherenceText) && (
                    <p className="text-xs mt-1.5" style={{ color: colors.primary }}>
                      {[streakText, adherenceText].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
