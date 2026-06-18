/**
 * Shared show-day checklist for a contest prep (coach + athlete, realtime).
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isCoach as checkIsCoach } from '@/lib/roles';
import { DEFAULT_SHOW_DAY_TASKS, SHOW_DAY_CATEGORY_ORDER, SHOW_DAY_CATEGORY_LABELS } from '@/lib/showDayChecklist';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';
import { CheckCircle2, Circle } from 'lucide-react';

async function seedTasksIfEmpty(supabase, prepId) {
  const { count, error: cErr } = await supabase
    .from('show_day_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('contest_prep_id', prepId);
  if (cErr || (count ?? 0) > 0) return;
  const rows = DEFAULT_SHOW_DAY_TASKS.map((t) => ({
    contest_prep_id: prepId,
    task_category: t.category,
    task_name: t.name,
    assigned_to: t.assigned_to,
  }));
  await supabase.from('show_day_tasks').insert(rows);
}

export default function ShowDayChecklistPage() {
  const navigate = useNavigate();
  const { prepId } = useParams();
  const { user, role } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const viewerIsCoach = checkIsCoach(role);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showName, setShowName] = useState('');

  const loadTasks = useCallback(async () => {
    if (!supabase || !prepId) return;
    setLoading(true);
    try {
      const { data: prep } = await supabase
        .from('contest_preps')
        .select('id, show_name, client_id')
        .eq('id', prepId)
        .maybeSingle();
      if (!prep) {
        setTasks([]);
        setLoading(false);
        return;
      }
      setShowName(prep.show_name || 'Show');
      await seedTasksIfEmpty(supabase, prepId);
      const { data, error } = await supabase
        .from('show_day_tasks')
        .select('*')
        .eq('contest_prep_id', prepId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.message || 'Could not load checklist');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, prepId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!supabase || !prepId) return;
    const channel = supabase
      .channel(`show_day_tasks_${prepId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'show_day_tasks', filter: `contest_prep_id=eq.${prepId}` },
        () => {
          loadTasks();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, prepId, loadTasks]);

  const completed = tasks.filter((t) => t.is_complete).length;
  const total = tasks.length;

  const toggle = async (task) => {
    if (!supabase || !user?.id) return;
    hapticLight();
    const next = !task.is_complete;
    const { error } = await supabase
      .from('show_day_tasks')
      .update({
        is_complete: next,
        completed_by: next ? user.id : null,
        completed_at: next ? new Date().toISOString() : null,
      })
      .eq('id', task.id);
    if (error) toast.error(error.message);
    else loadTasks();
  };

  const byCategory = useMemo(() => {
    const m = {};
    for (const c of SHOW_DAY_CATEGORY_ORDER) m[c] = [];
    for (const t of tasks) {
      if (!m[t.task_category]) m[t.task_category] = [];
      m[t.task_category].push(t);
    }
    return m;
  }, [tasks]);

  const renderTaskRow = (t) => (
    <button
      key={t.id}
      type="button"
      className="w-full flex items-start gap-3 text-left py-3 border-b last:border-0"
      style={{ borderColor: colors.border, color: colors.text }}
      onClick={() => toggle(t)}
    >
      {t.is_complete ? <CheckCircle2 size={22} style={{ color: colors.success, flexShrink: 0 }} /> : <Circle size={22} style={{ color: colors.muted, flexShrink: 0 }} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.task_name}</p>
        <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
          {t.assigned_to === 'both' ? 'Coach & athlete' : t.assigned_to === 'coach' ? 'Coach' : 'Athlete'}
        </p>
      </div>
    </button>
  );

  const athleteSections = useMemo(() => {
    const yours = tasks.filter((t) => t.assigned_to === 'athlete' || t.assigned_to === 'both');
    const coach = tasks.filter((t) => t.assigned_to === 'coach');
    return { yours, coach };
  }, [tasks]);

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Show day checklist" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-sm mb-3" style={{ color: colors.muted }}>{showName}</p>
        <div className="rounded-xl p-3 mb-4" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}>
          <p className="text-sm font-semibold" style={{ color: colors.text }}>
            {completed} of {total || '—'} tasks complete
          </p>
          {total > 0 && (
            <div className="h-2 rounded-full mt-2 overflow-hidden" style={{ background: colors.border }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((completed / total) * 100)}%`, background: colors.primary }} />
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
        ) : viewerIsCoach ? (
          <div className="space-y-4">
            {SHOW_DAY_CATEGORY_ORDER.map((cat) => {
              const list = byCategory[cat] || [];
              if (!list.length) return null;
              return (
                <Card key={cat} style={{ padding: spacing[12], border: `1px solid ${colors.border}` }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
                    {SHOW_DAY_CATEGORY_LABELS[cat] || cat}
                  </p>
                  {list.map((t) => renderTaskRow(t))}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <Card style={{ padding: spacing[12], border: `1px solid ${colors.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Your tasks</p>
              {athleteSections.yours.map((t) => renderTaskRow(t))}
            </Card>
            <Card style={{ padding: spacing[12], border: `1px solid ${colors.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Coach tasks</p>
              {athleteSections.coach.map((t) => renderTaskRow(t))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
