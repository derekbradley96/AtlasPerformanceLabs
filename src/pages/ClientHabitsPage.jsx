/**
 * Coach habit management for a client: create, edit, activate/deactivate, delete habits.
 * Shows title, category, target, adherence 7d, current streak. Quick-create presets.
 * Uses: client_habits, v_client_habit_adherence. Atlas coach shell styling.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { Plus, Trash2, X, ClipboardList } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { HabitCardSkeleton } from '@/components/ui/LoadingState';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'steps', label: 'Steps' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'water', label: 'Water' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'posing', label: 'Posing' },
  { value: 'supplement', label: 'Supplement' },
  { value: 'custom', label: 'Custom' },
];

const TARGET_TYPES = [
  { value: 'boolean', label: 'Done / not done' },
  { value: 'numeric_min', label: 'At least (min)' },
  { value: 'numeric_exact', label: 'Exactly' },
];

const PRESETS = [
  { title: 'Steps', category: 'steps', target_type: 'numeric_min', target_value: 10000, unit: '', description: 'Daily step count' },
  { title: 'Sleep', category: 'sleep', target_type: 'numeric_min', target_value: 7, unit: 'h', description: 'Hours of sleep' },
  { title: 'Water', category: 'water', target_type: 'numeric_min', target_value: 3, unit: 'L', description: 'Liters per day' },
  { title: 'Cardio', category: 'cardio', target_type: 'numeric_min', target_value: 30, unit: 'min', description: 'Cardio minutes' },
  { title: 'Supplements', category: 'supplement', target_type: 'boolean', target_value: null, unit: null, description: 'Take supplements' },
  { title: 'Daily posing', category: 'posing', target_type: 'numeric_min', target_value: 15, unit: 'min', description: 'Posing practice' },
];

function targetLabel(habit) {
  if (habit.target_type === 'boolean') return 'Done daily';
  const v = habit.target_value != null ? Number(habit.target_value) : '';
  const u = habit.unit || '';
  if (habit.target_type === 'numeric_min') return `≥ ${v} ${u}`.trim();
  if (habit.target_type === 'numeric_exact') return `= ${v} ${u}`.trim();
  return '—';
}

export default function ClientHabitsPage() {
  const navigate = useNavigate();
  const { id: clientIdParam } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [clientId, setClientId] = useState(clientIdParam || null);
  const [clientName, setClientName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'custom',
    target_type: 'numeric_min',
    target_value: '',
    unit: '',
  });

  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;

  useEffect(() => {
    if (clientIdParam) setClientId(clientIdParam);
  }, [clientIdParam]);

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data } = await supabase.from('clients').select('id, name, full_name').eq('id', clientId).maybeSingle();
      return data;
    },
    enabled: !!supabase && !!clientId,
  });

  useEffect(() => {
    if (client) setClientName(client.name || client.full_name || 'Client');
  }, [client]);

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['client_habits', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_habits')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: adherenceRows = [] } = useQuery({
    queryKey: ['v_client_habit_adherence', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('v_client_habit_adherence')
        .select('habit_id, adherence_last_7d, current_streak_days')
        .eq('client_id', clientId);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const adherenceByHabitId = useMemo(() => {
    const map = {};
    adherenceRows.forEach((r) => { map[r.habit_id] = r; });
    return map;
  }, [adherenceRows]);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      if (!supabase || !clientId || !coachId) throw new Error('Missing client or coach');
      const { error } = await supabase.from('client_habits').insert({
        client_id: clientId,
        coach_id: coachId,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        category: payload.category,
        target_type: payload.target_type,
        target_value: payload.target_value !== '' && payload.target_value != null ? Number(payload.target_value) : null,
        unit: payload.unit?.trim() || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_habits', clientId] });
      queryClient.invalidateQueries({ queryKey: ['v_client_habit_adherence', clientId] });
      toast.success('Habit created');
      setShowForm(false);
      setForm({ title: '', description: '', category: 'custom', target_type: 'numeric_min', target_value: '', unit: '' });
    },
    onError: (e) => toast.error(e?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, is_active, ...rest }) => {
      if (!supabase || !id) throw new Error('Missing habit');
      const payload = {};
      if (typeof is_active === 'boolean') payload.is_active = is_active;
      if (rest.title !== undefined) payload.title = rest.title.trim();
      if (rest.description !== undefined) payload.description = rest.description?.trim() || null;
      if (rest.category !== undefined) payload.category = rest.category;
      if (rest.target_type !== undefined) payload.target_type = rest.target_type;
      if (rest.target_value !== undefined) payload.target_value = rest.target_value !== '' ? Number(rest.target_value) : null;
      if (rest.unit !== undefined) payload.unit = rest.unit?.trim() || null;
      const { error } = await supabase.from('client_habits').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_habits', clientId] });
      queryClient.invalidateQueries({ queryKey: ['v_client_habit_adherence', clientId] });
      toast.success('Updated');
      setEditingId(null);
    },
    onError: (e) => toast.error(e?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (habitId) => {
      if (!supabase || !habitId) throw new Error('Missing habit');
      const { error } = await supabase.from('client_habits').delete().eq('id', habitId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_habits', clientId] });
      queryClient.invalidateQueries({ queryKey: ['v_client_habit_adherence', clientId] });
      toast.success('Habit removed');
    },
    onError: (e) => toast.error(e?.message || 'Failed to delete'),
  });

  const applyPreset = (preset) => {
    hapticLight();
    setForm({
      title: preset.title,
      description: preset.description || '',
      category: preset.category,
      target_type: preset.target_type,
      target_value: preset.target_value != null ? String(preset.target_value) : '',
      unit: preset.unit || '',
    });
    setShowForm(true);
    setEditingId(null);
  };

  const openEdit = (habit) => {
    setForm({
      title: habit.title || '',
      description: habit.description || '',
      category: habit.category || 'custom',
      target_type: habit.target_type || 'numeric_min',
      target_value: habit.target_value != null ? String(habit.target_value) : '',
      unit: habit.unit || '',
    });
    setEditingId(habit.id);
    setShowForm(false);
  };

  const submitCreate = () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    createMutation.mutate(form);
  };

  const submitUpdate = () => {
    if (!editingId) return;
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    updateMutation.mutate({
      id: editingId,
      title: form.title,
      description: form.description,
      category: form.category,
      target_type: form.target_type,
      target_value: form.target_value,
      unit: form.unit,
    });
  };

  const toggleActive = (habit) => {
    hapticLight();
    updateMutation.mutate({ id: habit.id, is_active: !habit.is_active });
  };

  if (!clientId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Habits" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p style={{ color: colors.muted }}>No client selected.</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  const cardStyle = { ...standardCard, padding: spacing[16] };

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Habits" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="atlas-page-title">Habits</h1>
          <Button variant="outline" size="sm" onClick={() => { hapticLight(); navigate(`/clients/${clientId}`); }}>Back to client</Button>
        </div>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>Client: {clientName}</p>

        {/* Quick-create presets */}
        <section style={{ marginBottom: sectionGap }}>
          <div style={sectionLabel}>Quick-create</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.title}
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(p)}
                className="inline-flex items-center gap-1.5"
              >
                {p.title}
              </Button>
            ))}
          </div>
        </section>

        {/* Create / Edit form */}
        {(showForm || editingId) && (
          <Card style={{ ...cardStyle, marginBottom: sectionGap }}>
            <div className="flex items-center justify-between mb-3">
              <span style={sectionLabel}>{editingId ? 'Edit habit' : 'New habit'}</span>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} aria-label="Close">
                <X size={18} style={{ color: colors.muted }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Daily steps" className="mt-1 bg-black/20 border border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Description (optional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 bg-black/20 border border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 text-white p-2"
                  style={{ color: colors.text }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Target type</Label>
                <select
                  value={form.target_type}
                  onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value }))}
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 text-white p-2"
                  style={{ color: colors.text }}
                >
                  {TARGET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {form.target_type !== 'boolean' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs" style={{ color: colors.muted }}>Target value</Label>
                    <Input type="number" value={form.target_value} onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} className="mt-1 bg-black/20 border border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: colors.muted }}>Unit</Label>
                    <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. min, L" className="mt-1 bg-black/20 border border-white/10 text-white" />
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                {editingId ? (
                  <Button onClick={submitUpdate} disabled={updateMutation.isPending}>Save changes</Button>
                ) : (
                  <Button onClick={submitCreate} disabled={createMutation.isPending}>Create habit</Button>
                )}
                <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {!showForm && !editingId && (
          <Button variant="outline" className="w-full mb-4" onClick={() => { hapticLight(); setShowForm(true); setForm({ title: '', description: '', category: 'custom', target_type: 'numeric_min', target_value: '', unit: '' }); }}>
            <Plus size={18} className="mr-2" /> Add habit
          </Button>
        )}

        {/* Current habits list */}
        <section>
          <div style={sectionLabel}>Current habits</div>
          {habitsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <HabitCardSkeleton key={i} />
              ))}
            </div>
          ) : habits.length === 0 ? (
            <EmptyState
              title="No habits for this client yet"
              description="Assign daily habits (steps, sleep, water, etc.) so your client can track adherence. Use a quick-create preset above or add a custom habit."
              icon={ClipboardList}
              actionLabel="Add first habit"
              onAction={() => { hapticLight(); setShowForm(true); setForm({ title: '', description: '', category: 'custom', target_type: 'numeric_min', target_value: '', unit: '' }); }}
            />
          ) : (
            <ul className="space-y-2">
              {habits.map((h) => {
                const adh = adherenceByHabitId[h.id];
                return (
                  <li key={h.id}>
                    <Card style={{ ...cardStyle, opacity: h.is_active ? 1 : 0.7 }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" style={{ color: colors.text }}>{h.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                            {CATEGORIES.find((c) => c.value === h.category)?.label ?? h.category} · {targetLabel(h)}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            {adh != null && (
                              <>
                                <span style={{ color: colors.muted }}>7d: {adh.adherence_last_7d != null ? `${Number(adh.adherence_last_7d)}%` : '—'}</span>
                                <span style={{ color: colors.muted }}>Streak: {adh.current_streak_days != null ? adh.current_streak_days : '—'} days</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!h.is_active}
                              onChange={() => toggleActive(h)}
                              className="rounded border-white/20"
                            />
                            <span className="text-xs" style={{ color: colors.muted }}>Active</span>
                          </label>
                          <Button variant="ghost" size="sm" onClick={() => { hapticLight(); openEdit(h); }}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-400" onClick={() => { hapticLight(); if (window.confirm('Remove this habit?')) deleteMutation.mutate(h.id); }}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
