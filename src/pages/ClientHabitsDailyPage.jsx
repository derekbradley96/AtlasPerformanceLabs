/**
 * Client daily habit logging: view today’s active habits and log value/completion.
 * Boolean habits → toggle; numeric_min / numeric_exact → number input. Saves to client_habit_logs.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { HabitCardSkeleton } from '@/components/ui/LoadingState';
import { CheckSquare, Square, ClipboardList } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';
import { notifyClientHabitMissed } from '@/services/notificationTriggers';

const CATEGORY_LABELS = {
  steps: 'Steps',
  sleep: 'Sleep',
  water: 'Water',
  nutrition: 'Nutrition',
  cardio: 'Cardio',
  posing: 'Posing',
  supplement: 'Supplement',
  custom: 'Custom',
};

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function targetLabel(habit) {
  if (habit.target_type === 'boolean') return 'Done today';
  const v = habit.target_value != null ? Number(habit.target_value) : '';
  const u = (habit.unit || '').trim();
  if (habit.target_type === 'numeric_min') return `Target: ≥ ${v} ${u}`.trim();
  if (habit.target_type === 'numeric_exact') return `Target: ${v} ${u}`.trim();
  return '';
}

function computeCompleted(habit, value) {
  if (habit.target_type === 'boolean') return value === 1 || value === true;
  const num = value != null && value !== '' ? Number(value) : null;
  if (num === null) return false;
  const target = habit.target_value != null ? Number(habit.target_value) : null;
  if (habit.target_type === 'numeric_min') return target != null && num >= target;
  if (habit.target_type === 'numeric_exact') return target != null && num === target;
  return false;
}

export default function ClientHabitsDailyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const todayStr = useMemo(() => toISODate(new Date()), []);

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['client-identity', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return null;
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!supabase && !!user?.id,
  });

  const clientId = client?.id ?? null;

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['client_habits_active', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_habits')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('title');
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: logsToday = [], isLoading: logsLoading } = useQuery({
    queryKey: ['client_habit_logs', clientId, todayStr],
    queryFn: async () => {
      if (!supabase || !clientId || !todayStr) return [];
      const { data, error } = await supabase
        .from('client_habit_logs')
        .select('id, habit_id, value, completed, notes')
        .eq('client_id', clientId)
        .eq('log_date', todayStr);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId && !!todayStr,
  });

  const logByHabitId = useMemo(() => {
    const map = {};
    logsToday.forEach((l) => { map[l.habit_id] = l; });
    return map;
  }, [logsToday]);

  const incompleteCount = useMemo(() => {
    if (!habits.length) return 0;
    return habits.filter((h) => !(logByHabitId[h.id]?.completed ?? false)).length;
  }, [habits, logByHabitId]);

  const habitReminderSentRef = useRef(false);
  useEffect(() => {
    if (!user?.id || incompleteCount === 0 || habitReminderSentRef.current) return;
    const key = `habit_reminder_${todayStr}`;
    if (sessionStorage.getItem(key)) return;
    habitReminderSentRef.current = true;
    sessionStorage.setItem(key, '1');
    notifyClientHabitMissed(user.id).catch(() => {});
  }, [user?.id, todayStr, incompleteCount]);

  const [pendingNumeric, setPendingNumeric] = useState({});

  const upsertMutation = useMutation({
    mutationFn: async ({ habit_id, value, completed }) => {
      if (!supabase || !clientId || !todayStr) throw new Error('Missing client or date');
      const payload = {
        habit_id,
        client_id: clientId,
        log_date: todayStr,
        value: value != null && value !== '' ? Number(value) : null,
        completed: Boolean(completed),
        notes: null,
      };
      const { error } = await supabase
        .from('client_habit_logs')
        .upsert(payload, { onConflict: 'habit_id,log_date' });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      setPendingNumeric((prev) => ({ ...prev, [variables.habit_id]: undefined }));
      queryClient.invalidateQueries({ queryKey: ['client_habit_logs', clientId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['v_client_habit_adherence', clientId] });
    },
    onError: (e) => toast.error(e?.message || 'Failed to save'),
  });

  const handleBooleanToggle = (habit) => {
    hapticLight();
    const log = logByHabitId[habit.id];
    const nextCompleted = !(log?.completed ?? false);
    upsertMutation.mutate({
      habit_id: habit.id,
      value: nextCompleted ? 1 : 0,
      completed: nextCompleted,
    });
  };

  const handleNumericChange = (habit, inputValue) => {
    const num = inputValue === '' || inputValue == null ? null : Number(inputValue);
    const completed = computeCompleted(habit, num);
    upsertMutation.mutate({
      habit_id: habit.id,
      value: num,
      completed,
    });
  };

  const loading = loadingClient || habitsLoading || logsLoading;

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Daily habits" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p style={{ color: colors.muted }}>Sign in to log habits.</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  if (!clientId && !loadingClient) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Daily habits" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <EmptyState
            title="No client profile"
            description="Daily habits are for clients with a coach. Link with a coach to get assigned habits."
            icon={ClipboardList}
            actionLabel="Back"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  if (habits.length === 0 && !loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Daily habits" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <EmptyState
            title="No habits assigned yet"
            description="Your coach hasn't set up any daily habits for you yet. Once they add habits like steps, sleep, or water, you'll log them here."
            icon={ClipboardList}
            actionLabel="Back to home"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  const cardStyle = { ...standardCard, padding: spacing[16] };

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Daily habits" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Today: {todayStr ? new Date(todayStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : ''}
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <HabitCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {habits.map((habit) => {
              const log = logByHabitId[habit.id];
              const categoryLabel = CATEGORY_LABELS[habit.category] || habit.category || 'Custom';

              return (
                <li key={habit.id}>
                  <Card style={cardStyle}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium" style={{ color: colors.text }}>{habit.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                          {categoryLabel} · {targetLabel(habit)}
                        </p>
                        {habit.target_type === 'boolean' ? (
                          <button
                            type="button"
                            className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
                            style={{
                              borderColor: log?.completed ? colors.primary : colors.border,
                              background: log?.completed ? colors.primarySubtle : 'transparent',
                              color: colors.text,
                            }}
                            onClick={() => handleBooleanToggle(habit)}
                          >
                            {log?.completed ? (
                              <CheckSquare size={20} style={{ color: colors.primary }} />
                            ) : (
                              <Square size={20} style={{ color: colors.muted }} />
                            )}
                            <span className="text-sm">{log?.completed ? 'Done' : 'Mark done'}</span>
                          </button>
                        ) : (
                          <div className="mt-3 flex items-center gap-2">
                            <Input
                              type="number"
                              min={habit.target_type === 'numeric_exact' ? habit.target_value : 0}
                              step={habit.unit === 'h' ? 0.5 : 1}
                              value={pendingNumeric[habit.id] !== undefined
                                ? pendingNumeric[habit.id]
                                : (log?.value != null ? String(log.value) : '')}
                              onChange={(e) => setPendingNumeric((prev) => ({ ...prev, [habit.id]: e.target.value }))}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (v === '') {
                                  upsertMutation.mutate({ habit_id: habit.id, value: null, completed: false });
                                  return;
                                }
                                const num = Number(v);
                                if (!Number.isNaN(num)) handleNumericChange(habit, num);
                              }}
                              placeholder={habit.target_value != null ? `e.g. ${habit.target_value}` : ''}
                              className="max-w-[120px] bg-black/20 border border-white/10 text-white"
                            />
                            {habit.unit && (
                              <span className="text-sm" style={{ color: colors.muted }}>{habit.unit}</span>
                            )}
                            {log?.completed && (
                              <span className="text-xs font-medium" style={{ color: colors.success }}>✓</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
