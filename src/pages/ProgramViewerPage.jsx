/**
 * Read-only program viewer: block name, week tabs, days in selected week, exercises per day.
 * Entry: Today (View Full Program), Client Detail (View Program), assignment summary.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { ListOrdered } from 'lucide-react';

const PAGE_PADDING = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
const SECTION_LABEL = { fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted, marginBottom: spacing[8] };

async function fetchBlock(supabase, blockId) {
  if (!supabase || !blockId) return null;
  const { data, error } = await supabase.from('program_blocks').select('id, title, total_weeks').eq('id', blockId).maybeSingle();
  return error ? null : data;
}

async function fetchWeeks(supabase, blockId) {
  if (!supabase || !blockId) return [];
  const { data, error } = await supabase.from('program_weeks').select('id, block_id, week_number').eq('block_id', blockId).order('week_number');
  return error ? [] : (data || []);
}

async function fetchDays(supabase, weekId) {
  if (!supabase || !weekId) return [];
  const { data, error } = await supabase.from('program_days').select('id, week_id, day_number, title').eq('week_id', weekId).order('day_number');
  return error ? [] : (data || []);
}

async function fetchExercisesForDays(supabase, dayIds) {
  if (!supabase || !dayIds?.length) return [];
  const { data, error } = await supabase
    .from('program_exercises')
    .select('id, day_id, exercise_name, sets, reps, percentage, notes, sort_order')
    .in('day_id', dayIds)
    .order('day_id')
    .order('sort_order');
  if (error) return [];
  return data || [];
}

export default function ProgramViewerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const blockId = searchParams.get('blockId');
  const clientId = searchParams.get('clientId');

  const [block, setBlock] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [days, setDays] = useState([]);
  const [exercisesByDay, setExercisesByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  const supabase = hasSupabase ? getSupabase() : null;
  const selectedWeek = weeks[selectedWeekIndex] ?? null;

  useEffect(() => {
    if (!blockId || !supabase) {
      setBlock(null);
      setWeeks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const b = await fetchBlock(supabase, blockId);
      if (cancelled) return;
      setBlock(b);
      if (!b) {
        setWeeks([]);
        setLoading(false);
        return;
      }
      const wList = await fetchWeeks(supabase, b.id);
      if (!cancelled) setWeeks(wList);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [blockId, supabase]);

  useEffect(() => {
    if (!selectedWeek?.id || !supabase) {
      setDays([]);
      setExercisesByDay({});
      return;
    }
    let cancelled = false;
    (async () => {
      const dList = await fetchDays(supabase, selectedWeek.id);
      if (cancelled) return;
      setDays(dList);
      if (!dList.length) {
        setExercisesByDay({});
        return;
      }
      const dayIds = dList.map((d) => d.id);
      const exList = await fetchExercisesForDays(supabase, dayIds);
      if (cancelled) return;
      const byDay = {};
      dayIds.forEach((id) => { byDay[id] = []; });
      (exList || []).forEach((ex) => {
        if (byDay[ex.day_id]) byDay[ex.day_id].push(ex);
      });
      setExercisesByDay(byDay);
    })();
    return () => { cancelled = true; };
  }, [selectedWeek?.id, supabase]);

  const totalWeeks = block?.total_weeks ?? Math.max(1, weeks.length);
  const weekNumbers = useMemo(() => Array.from({ length: totalWeeks }, (_, i) => i + 1), [totalWeeks]);

  if (!blockId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
        <p style={{ color: colors.muted }}>No program selected.</p>
        <button type="button" onClick={() => navigate(-1)} style={{ position: 'absolute', left: 16, top: 16, color: colors.primary }}>Back</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
      </div>
    );
  }

  if (!block) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg }}>
        <TopBar title="Program" onBack={() => navigate(-1)} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24], textAlign: 'center' }}>
          <p style={{ color: colors.muted }}>Program not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Program" onBack={() => navigate(-1)} />
      <div style={{ ...PAGE_PADDING, paddingTop: spacing[16] }}>
        <div style={{ marginBottom: spacing[20] }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>
            {block.title || 'Program'}
          </h1>
          <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
            {totalWeeks} week{totalWeeks !== 1 ? 's' : ''}
          </p>
        </div>

        <p className="font-medium uppercase tracking-wide" style={SECTION_LABEL}>Week</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {weekNumbers.map((num) => {
            const week = weeks.find((w) => w.week_number === num);
            const isSelected = selectedWeek?.week_number === num;
            const disabled = !week;
            return (
              <button
                key={num}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  const idx = weeks.findIndex((w) => w.week_number === num);
                  setSelectedWeekIndex(idx >= 0 ? idx : 0);
                }}
                disabled={disabled}
                style={{
                  padding: `${spacing[8]}px ${spacing[14]}px`,
                  borderRadius: radii.button,
                  border: `1px solid ${isSelected ? colors.primary : shell.cardBorder}`,
                  background: isSelected ? colors.primarySubtle : 'transparent',
                  color: disabled ? colors.muted : isSelected ? colors.primary : colors.text,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.7 : 1,
                }}
              >
                Week {num}
              </button>
            );
          })}
        </div>

        {!selectedWeek && (
          <p style={{ color: colors.muted, fontSize: 14 }}>Select a week.</p>
        )}

        {selectedWeek && days.length === 0 && (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p style={{ color: colors.muted, margin: 0 }}>No days in this week.</p>
          </Card>
        )}

        {selectedWeek && days.length > 0 && (
          <div className="space-y-6">
            <p className="font-medium uppercase tracking-wide" style={SECTION_LABEL}>Days</p>
            {days.map((day) => {
              const exercises = exercisesByDay[day.id] ?? [];
              return (
                <Card key={day.id} style={{ padding: spacing[16], overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: spacing[12] }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: shell.iconContainerRadius,
                        background: colors.primarySubtle,
                        color: colors.primary,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ListOrdered size={18} strokeWidth={2} />
                    </span>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                        {day.title || `Day ${day.day_number}`}
                      </p>
                      <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                        {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {exercises.map((ex, idx) => (
                      <li
                        key={ex.id || idx}
                        style={{
                          padding: `${spacing[10]}px 0`,
                          borderTop: idx === 0 ? 'none' : `1px solid ${shell.cardBorder}`,
                        }}
                      >
                        <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: 0 }}>
                          {ex.exercise_name || ex.name || 'Exercise'}
                        </p>
                        <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: 2 }}>
                          {[ex.sets != null && `${ex.sets} sets`, ex.reps != null && `${ex.reps} reps`, ex.percentage != null && `${ex.percentage}%`]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                          {ex.notes ? ` · ${ex.notes}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
