/**
 * Program Builder 2.0: Block timeline, week/day selector, exercise list + editor, duplicate week/day.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getProgramBlock,
  listProgramWeeks,
  listProgramDays,
  listProgramExercises,
  upsertProgramExercise,
  deleteProgramExercise,
  reorderProgramExercises,
  duplicateWeek as repoDuplicateWeek,
  duplicateDay as repoDuplicateDay,
} from '@/lib/supabaseRepo/phaseProgramRepo';
import { hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { ChevronLeft, Plus, Trash2, Pencil } from 'lucide-react';

const SCHEME_OPTIONS = ['straight', 'drop_set', 'rest_pause', 'cluster', 'emom', 'amrap', 'other'];

export default function ProgramBlockBuilder() {
  const { id: clientId, blockId } = useParams();
  const navigate = useNavigate();
  const [block, setBlock] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWeekNum, setSelectedWeekNum] = useState(1);
  const [selectedDayNum, setSelectedDayNum] = useState(1);
  const [exerciseModal, setExerciseModal] = useState(null); // { id?, dayId, initial }
  const [dupWeekOpen, setDupWeekOpen] = useState(false);
  const [dupWeekFrom, setDupWeekFrom] = useState(1);
  const [dupWeekTo, setDupWeekTo] = useState(2);
  const [dupWeekSaving, setDupWeekSaving] = useState(false);
  const [dupDayOpen, setDupDayOpen] = useState(false);
  const [dupDaySource, setDupDaySource] = useState(1);
  const [dupDayTarget, setDupDayTarget] = useState(2);
  const [dupDaySaving, setDupDaySaving] = useState(false);

  const selectedWeek = weeks.find((w) => w.week_number === selectedWeekNum);
  const selectedDay = days.find((d) => d.day_number === selectedDayNum);

  const loadBlock = useCallback(async () => {
    if (!blockId || !hasSupabase) return;
    setLoading(true);
    setError(null);
    try {
      const b = await getProgramBlock(blockId);
      if (!b) throw new Error('Block not found');
      setBlock(b);
    } catch (err) {
      console.error('[ProgramBlockBuilder] loadBlock', err);
      setError(err?.message ?? 'Failed to load block');
      setBlock(null);
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  const loadWeeks = useCallback(async () => {
    if (!blockId || !hasSupabase) return;
    try {
      const list = await listProgramWeeks(blockId);
      setWeeks(list);
      if (list.length && !selectedWeekNum) setSelectedWeekNum(list[0].week_number);
    } catch (err) {
      console.error('[ProgramBlockBuilder] loadWeeks', err);
      setWeeks([]);
    }
  }, [blockId]);

  const loadDays = useCallback(async () => {
    if (!selectedWeek?.id) return;
    try {
      const list = await listProgramDays(selectedWeek.id);
      setDays(list);
      if (list.length && selectedDayNum > list.length) setSelectedDayNum(1);
    } catch (err) {
      console.error('[ProgramBlockBuilder] loadDays', err);
      setDays([]);
    }
  }, [selectedWeek?.id, selectedDayNum]);

  const loadExercises = useCallback(async () => {
    if (!selectedDay?.id) return;
    try {
      const list = await listProgramExercises(selectedDay.id);
      setExercises(list);
    } catch (err) {
      console.error('[ProgramBlockBuilder] loadExercises', err);
      setExercises([]);
    }
  }, [selectedDay?.id]);

  useEffect(() => {
    loadBlock();
  }, [loadBlock]);
  useEffect(() => {
    loadWeeks();
  }, [loadWeeks]);
  useEffect(() => {
    loadDays();
  }, [loadDays]);
  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  useEffect(() => {
    if (weeks.length && !weeks.find((w) => w.week_number === selectedWeekNum)) {
      setSelectedWeekNum(weeks[0]?.week_number ?? 1);
    }
  }, [weeks, selectedWeekNum]);
  useEffect(() => {
    if (days.length && !days.find((d) => d.day_number === selectedDayNum)) {
      setSelectedDayNum(days[0]?.day_number ?? 1);
    }
  }, [days, selectedDayNum]);

  const handleDuplicateWeek = useCallback(async () => {
    if (!blockId || dupWeekFrom === dupWeekTo) return;
    setDupWeekSaving(true);
    try {
      await repoDuplicateWeek(blockId, dupWeekFrom, dupWeekTo);
      toast.success(`Week ${dupWeekFrom} copied to Week ${dupWeekTo}`);
      setDupWeekOpen(false);
      if (selectedWeekNum === dupWeekTo) loadExercises();
    } catch (err) {
      toast.error(err?.message ?? 'Duplicate week failed');
    } finally {
      setDupWeekSaving(false);
    }
  }, [blockId, dupWeekFrom, dupWeekTo, selectedWeekNum, loadExercises]);

  const handleDuplicateDay = useCallback(async () => {
    if (!selectedWeek?.id || dupDaySource === dupDayTarget) return;
    const sourceDay = days.find((d) => d.day_number === dupDaySource);
    const targetDay = days.find((d) => d.day_number === dupDayTarget);
    if (!sourceDay || !targetDay) return;
    setDupDaySaving(true);
    try {
      await repoDuplicateDay(sourceDay.id, targetDay.id);
      toast.success(`Day ${dupDaySource} copied to Day ${dupDayTarget}`);
      setDupDayOpen(false);
      if (selectedDayNum === dupDayTarget) loadExercises();
    } catch (err) {
      toast.error(err?.message ?? 'Duplicate day failed');
    } finally {
      setDupDaySaving(false);
    }
  }, [selectedWeek?.id, days, dupDaySource, dupDayTarget, selectedDayNum, loadExercises]);

  const handleSaveExercise = useCallback(
    async (payload) => {
      if (!exerciseModal?.dayId) return;
      try {
        await upsertProgramExercise(exerciseModal.dayId, { ...payload, id: exerciseModal.initial?.id });
        setExerciseModal(null);
        loadExercises();
        toast.success(payload.id ? 'Exercise updated' : 'Exercise added');
      } catch (err) {
        toast.error(err?.message ?? 'Save failed');
      }
    },
    [exerciseModal, loadExercises]
  );

  const handleDeleteExercise = useCallback(
    async (exerciseId) => {
      try {
        await deleteProgramExercise(exerciseId);
        loadExercises();
        toast.success('Exercise removed');
      } catch (err) {
        toast.error(err?.message ?? 'Delete failed');
      }
    },
    [loadExercises]
  );

  const handleReorderExercise = useCallback(
    async (index, direction) => {
      if (!selectedDay?.id || index < 0 || index >= exercises.length) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= exercises.length) return;
      const reordered = [...exercises];
      const a = reordered[index];
      reordered[index] = reordered[newIndex];
      reordered[newIndex] = a;
      const orderedIds = reordered.map((e) => e.id);
      try {
        await reorderProgramExercises(selectedDay.id, orderedIds);
        loadExercises();
        toast.success('Order updated');
      } catch (err) {
        toast.error(err?.message ?? 'Reorder failed');
      }
    },
    [selectedDay?.id, exercises, loadExercises]
  );

  if (!hasSupabase) {
    return (
      <div className="p-4" style={{ color: colors.text }}>
        <p>Program Builder requires Supabase.</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  if (loading && !block) {
    return (
      <div className="p-8 flex justify-center" style={{ color: colors.muted }}>
        <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="p-4" style={{ color: colors.text }}>
        <p style={{ color: colors.destructive }}>{error ?? 'Block not found'}</p>
        <Button variant="secondary" onClick={() => clientId && navigate(`/clients/${clientId}`)}>Back to client</Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full app-screen" style={{ background: colors.bg, color: colors.text, padding: spacing[16], paddingBottom: 80 }}>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => clientId && navigate(`/clients/${clientId}`)}
          className="p-2 rounded-lg"
          style={{ color: colors.text, background: colors.surface1 }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold truncate" style={{ color: colors.text }}>{block.title}</h1>
      </div>

      {/* Timeline: Week selector */}
      <Card style={{ padding: spacing[12], marginBottom: spacing[16] }}>
        <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Week</p>
        <div className="flex flex-wrap gap-2">
          {(block.total_weeks ? Array.from({ length: block.total_weeks }, (_, i) => i + 1) : []).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setSelectedWeekNum(num)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                background: selectedWeekNum === num ? colors.accent : colors.surface1,
                color: selectedWeekNum === num ? '#fff' : colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              {num}
            </button>
          ))}
        </div>
      </Card>

      {/* Day selector */}
      <Card style={{ padding: spacing[12], marginBottom: spacing[16] }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-xs font-medium" style={{ color: colors.muted }}>Day</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDupWeekOpen(true)}>Duplicate week</Button>
            <Button variant="secondary" size="sm" onClick={() => setDupDayOpen(true)}>Duplicate day</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDayNum(d.day_number)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                background: selectedDayNum === d.day_number ? colors.accent : colors.surface1,
                color: selectedDayNum === d.day_number ? '#fff' : colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              {d.title || `Day ${d.day_number}`}
            </button>
          ))}
        </div>
      </Card>

      {/* Exercises for selected day */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: colors.text }}>
            {selectedDay ? (selectedDay.title || `Day ${selectedDay.day_number}`) : 'Select a day'}
          </h2>
          {selectedDay && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExerciseModal({ dayId: selectedDay.id, initial: null })}
            >
              <Plus size={16} className="mr-1" />
              Add exercise
            </Button>
          )}
        </div>
        {!selectedDay ? (
          <p className="text-sm" style={{ color: colors.muted }}>Select a week and day above.</p>
        ) : (
          <ul className="space-y-2">
            {exercises.length === 0 && (
              <li className="text-sm py-4" style={{ color: colors.muted }}>No exercises yet. Add one to get started.</li>
            )}
            {exercises.map((ex, idx) => (
              <li
                key={ex.id}
                className="flex items-start justify-between gap-2 p-3 rounded-xl"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm" style={{ color: colors.text }}>{ex.exercise_name || 'Untitled'}</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                    {[ex.sets != null && `${ex.sets} sets`, ex.reps != null && `${ex.reps} reps`, ex.percentage != null && `${ex.percentage}%`, ex.scheme].filter(Boolean).join(' · ')}
                  </p>
                  {ex.notes && <p className="text-xs mt-1" style={{ color: colors.muted }}>{ex.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => handleReorderExercise(idx, 'up')}
                    disabled={idx === 0}
                    className="p-2 rounded-lg text-xs font-bold"
                    style={{ color: colors.muted }}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorderExercise(idx, 'down')}
                    disabled={idx === exercises.length - 1}
                    className="p-2 rounded-lg text-xs font-bold"
                    style={{ color: colors.muted }}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setExerciseModal({ dayId: selectedDay.id, initial: ex })}
                    className="p-2 rounded-lg"
                    style={{ color: colors.muted }}
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteExercise(ex.id)}
                    className="p-2 rounded-lg"
                    style={{ color: colors.destructive }}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dupWeekOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: colors.overlay }}>
          <Card style={{ padding: spacing[20], maxWidth: 320, width: '100%' }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Duplicate week</h3>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>Copy all days and exercises from one week to another (target will be overwritten).</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>From week</label>
                <select
                  value={dupWeekFrom}
                  onChange={(e) => setDupWeekFrom(Number(e.target.value))}
                  className="w-full rounded-xl py-2 px-3"
                  style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {Array.from({ length: block.total_weeks }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Week {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>To week</label>
                <select
                  value={dupWeekTo}
                  onChange={(e) => setDupWeekTo(Number(e.target.value))}
                  className="w-full rounded-xl py-2 px-3"
                  style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {Array.from({ length: block.total_weeks }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Week {n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setDupWeekOpen(false)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={handleDuplicateWeek} disabled={dupWeekSaving || dupWeekFrom === dupWeekTo} className="flex-1">
                {dupWeekSaving ? 'Copying…' : 'Copy'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {dupDayOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: colors.overlay }}>
          <Card style={{ padding: spacing[20], maxWidth: 320, width: '100%' }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Duplicate day</h3>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>Copy all exercises from one day to another in this week (target will be overwritten).</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>From day</label>
                <select
                  value={dupDaySource}
                  onChange={(e) => setDupDaySource(Number(e.target.value))}
                  className="w-full rounded-xl py-2 px-3"
                  style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {days.map((d) => (
                    <option key={d.id} value={d.day_number}>{d.title || `Day ${d.day_number}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>To day</label>
                <select
                  value={dupDayTarget}
                  onChange={(e) => setDupDayTarget(Number(e.target.value))}
                  className="w-full rounded-xl py-2 px-3"
                  style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {days.map((d) => (
                    <option key={d.id} value={d.day_number}>{d.title || `Day ${d.day_number}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setDupDayOpen(false)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={handleDuplicateDay} disabled={dupDaySaving || dupDaySource === dupDayTarget} className="flex-1">
                {dupDaySaving ? 'Copying…' : 'Copy'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {exerciseModal && (
        <ExerciseEditorModal
          dayId={exerciseModal.dayId}
          initial={exerciseModal.initial}
          onSave={handleSaveExercise}
          onClose={() => setExerciseModal(null)}
        />
      )}
    </div>
  );
}

function ExerciseEditorModal({ dayId, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    exercise_name: initial?.exercise_name ?? '',
    sets: initial?.sets ?? null,
    reps: initial?.reps ?? null,
    percentage: initial?.percentage ?? null,
    scheme: initial?.scheme ?? null,
    notes: initial?.notes ?? null,
    sort_order: initial?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        exercise_name: form.exercise_name.trim() || 'Untitled',
        sets: form.sets != null && form.sets !== '' ? Number(form.sets) : null,
        reps: form.reps != null && form.reps !== '' ? Number(form.reps) : null,
        percentage: form.percentage != null && form.percentage !== '' ? Number(form.percentage) : null,
        scheme: form.scheme || null,
        notes: form.notes?.trim() || null,
        sort_order: Number(form.sort_order) || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4" style={{ background: colors.overlay }}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: colors.bg }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>{initial ? 'Edit exercise' : 'Add exercise'}</h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.accent }}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Exercise name</label>
          <input
            type="text"
            value={form.exercise_name}
            onChange={(e) => setForm((p) => ({ ...p, exercise_name: e.target.value }))}
            placeholder="e.g. Back Squat"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Sets</label>
              <input
                type="number"
                min={0}
                value={form.sets ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, sets: e.target.value === '' ? null : e.target.value }))}
                className="w-full rounded-xl py-2 px-3"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Reps</label>
              <input
                type="number"
                min={0}
                value={form.reps ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, reps: e.target.value === '' ? null : e.target.value }))}
                className="w-full rounded-xl py-2 px-3"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Percentage</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.percentage ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, percentage: e.target.value === '' ? null : e.target.value }))}
                className="w-full rounded-xl py-2 px-3"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Scheme</label>
              <select
                value={form.scheme ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, scheme: e.target.value || null }))}
                className="w-full rounded-xl py-2 px-3"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
              >
                <option value="">—</option>
                {SCHEME_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes</label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="w-full rounded-xl py-2.5 px-3 mb-4 resize-none"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Sort order</label>
          <input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button type="submit" variant="primary" disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Add'}
          </Button>
        </form>
      </div>
    </div>
  );
}
