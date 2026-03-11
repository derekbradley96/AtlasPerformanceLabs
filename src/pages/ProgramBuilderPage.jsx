/**
 * Program Builder MVP – coach creates/edits program blocks using Supabase schema:
 * program_blocks → program_weeks → program_days → program_exercises.
 * Coach-only; Atlas shell. UI built from reusable program-builder components.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { standardCard, pageContainer, sectionLabel, sectionGap } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import BlockHeader from '@/components/program-builder/BlockHeader';
import WeekTabs from '@/components/program-builder/WeekTabs';
import DayTabs from '@/components/program-builder/DayTabs';
import ExerciseEditor from '@/components/program-builder/ExerciseEditor';
import { UserPlus, Save, User, ArrowLeft, Lightbulb, Calendar } from 'lucide-react';
import { suggestLoadIncrease } from '@/lib/programProgression';

/** Fetch coach's clients (coach_id or trainer_id = userId). */
async function fetchCoachClients(supabase, userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, name')
    .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('full_name');
  if (error) return [];
  return (data || []).map((c) => ({ id: c.id, name: c.full_name || c.name || 'Client' }));
}

/** Fetch block by id. */
async function fetchBlock(supabase, blockId) {
  if (!supabase || !blockId) return null;
  const { data, error } = await supabase.from('program_blocks').select('*').eq('id', blockId).maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Fetch weeks for block. */
async function fetchWeeks(supabase, blockId) {
  if (!supabase || !blockId) return [];
  const { data, error } = await supabase
    .from('program_weeks')
    .select('*')
    .eq('block_id', blockId)
    .order('week_number');
  return error ? [] : (data || []);
}

/** Fetch days for a week. */
async function fetchDays(supabase, weekId) {
  if (!supabase || !weekId) return [];
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('week_id', weekId)
    .order('day_number');
  return error ? [] : (data || []);
}

/** Fetch exercises for a day. */
async function fetchExercises(supabase, dayId) {
  if (!supabase || !dayId) return [];
  const { data, error } = await supabase
    .from('program_exercises')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  return error ? [] : (data || []);
}

export default function ProgramBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  const blockIdParam = searchParams.get('blockId');
  const contextSource = searchParams.get('source') || '';
  const contextReviewId = searchParams.get('review_id') || '';
  const contextNote = searchParams.get('note') || '';
  const { user, effectiveRole, coachFocus: rawCoachFocus } = useAuth();
  /** coach_focus from public.profiles (role=coach); drives prep-oriented labels. transformation = standard only. */
  const coachFocus = (rawCoachFocus ?? 'transformation').toString().trim().toLowerCase();
  const isPrepOriented = coachFocus === 'competition' || coachFocus === 'integrated';
  const adjustmentMode = contextSource === 'checkin' || contextSource === 'pose_check' || contextSource === 'client_detail';
  const contextBannerLabel =
    contextSource === 'checkin'
      ? 'check-in review'
      : contextSource === 'pose_check'
        ? 'pose check'
        : contextSource === 'client_detail'
          ? 'current client program'
          : '';
  const contextBannerTitle =
    contextSource === 'checkin'
      ? 'Adjusting plan after check-in review'
      : contextSource === 'pose_check'
        ? 'Adjusting prep plan after pose check'
        : contextSource === 'client_detail'
          ? 'Adjusting current client program'
          : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(clientIdParam || '');
  const [block, setBlock] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);

  const [blockName, setBlockName] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(4);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [coachSuggestions, setCoachSuggestions] = useState([]);

  const isCoachRole = isCoach(effectiveRole);
  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;

  const selectedWeek = weeks[selectedWeekIndex] || null;
  const selectedDay = days[selectedDayIndex] || null;

  const loadClients = useCallback(async () => {
    if (!supabase || !coachId) return;
    const list = await fetchCoachClients(supabase, coachId);
    setClients(list);
  }, [supabase, coachId]);

  const loadBlock = useCallback(async () => {
    if (!supabase || !blockIdParam) {
      setBlock(null);
      setWeeks([]);
      setDays([]);
      setExercises([]);
      setLoading(false);
      return;
    }
    const b = await fetchBlock(supabase, blockIdParam);
    setBlock(b);
    if (b) {
      setClientId(b.client_id || '');
      setBlockName(b.title || '');
      setTotalWeeks(Number(b.total_weeks) || 4);
      const wList = await fetchWeeks(supabase, b.id);
      setWeeks(wList);
      if (wList.length > 0) {
        const dList = await fetchDays(supabase, wList[0].id);
        setDays(dList);
        if (dList.length > 0) {
          const exList = await fetchExercises(supabase, dList[0].id);
          setExercises(exList);
        } else setExercises([]);
      } else setDays([]), setExercises([]);
    } else setWeeks([]), setDays([]), setExercises([]);
    setLoading(false);
  }, [supabase, blockIdParam]);

  useEffect(() => {
    if (!isCoachRole) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await loadClients();
      if (clientIdParam) setClientId(clientIdParam);
      if (blockIdParam) await loadBlock();
      else setLoading(false);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isCoachRole, coachId, blockIdParam, clientIdParam, loadClients, loadBlock]);

  useEffect(() => {
    if (!selectedWeek || !supabase) return;
    let cancelled = false;
    fetchDays(supabase, selectedWeek.id).then((dList) => {
      if (!cancelled) setDays(dList);
    });
    return () => { cancelled = true; };
  }, [selectedWeek?.id, supabase]);

  useEffect(() => {
    if (!selectedDay || !supabase) return;
    let cancelled = false;
    fetchExercises(supabase, selectedDay.id).then((exList) => {
      if (!cancelled) setExercises(exList);
    });
    return () => { cancelled = true; };
  }, [selectedDay?.id, supabase]);

  // Smart suggestions based on recent performance (v_exercise_progress)
  useEffect(() => {
    if (!supabase || !block?.id || (!clientId && !block?.client_id) || exercises.length === 0) {
      setCoachSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cId = clientId || block.client_id;
        const exerciseIds = exercises.map((e) => e.id).filter(Boolean);
        if (!exerciseIds.length) {
          if (!cancelled) setCoachSuggestions([]);
          return;
        }
        const { data, error } = await supabase
          .from('v_exercise_progress')
          .select('exercise_id, last_weight, last_reps, previous_weight, previous_reps, progression')
          .eq('client_id', cId)
          .in('exercise_id', exerciseIds);
        if (error || !data) {
          if (!cancelled) setCoachSuggestions([]);
          return;
        }
        let increaseCount = 0;
        let regressCount = 0;
        let flatCount = 0;
        for (const row of data) {
          const prog = row.progression != null ? Number(row.progression) : null;
          const loadSuggestion = suggestLoadIncrease(row);
          if (loadSuggestion) increaseCount += 1;
          if (prog != null && !Number.isNaN(prog)) {
            if (prog < -0.5) regressCount += 1;
            else if (Math.abs(prog) <= 0.5) flatCount += 1;
          }
        }
        const suggestions = [];
        if (increaseCount > 0) {
          suggestions.push('Increase load on progressing lifts for this block.');
        }
        if (regressCount > 0) {
          suggestions.push('Reduce sets or volume on lifts that are regressing.');
        }
        if (regressCount >= 2 || flatCount >= 3) {
          suggestions.push('Add a deload week or lighter microcycle to restore momentum.');
        }
        if (!cancelled) setCoachSuggestions(suggestions);
      } catch {
        if (!cancelled) setCoachSuggestions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, block?.id, clientId, block?.client_id, exercises]);

  const handleSaveBlock = async () => {
    if (!supabase || !coachId) return;
    if (!blockName.trim()) {
      toast.error('Enter a block name');
      return;
    }
    if (!clientId && !block?.client_id) {
      toast.error('Select a client');
      return;
    }
    const cId = clientId || block?.client_id;
    if (!cId) return;
    setSaving(true);
    try {
      if (block?.id) {
        const { error } = await supabase
          .from('program_blocks')
          .update({ title: blockName.trim(), total_weeks: Math.max(1, Math.min(52, totalWeeks)) })
          .eq('id', block.id);
        if (error) throw error;
        toast.success('Block saved');
      } else {
        const { data: inserted, error } = await supabase
          .from('program_blocks')
          .insert({ client_id: cId, title: blockName.trim(), total_weeks: Math.max(1, Math.min(52, totalWeeks)) })
          .select('id')
          .single();
        if (error) throw error;
        setBlock({ id: inserted.id, client_id: cId, title: blockName.trim(), total_weeks: totalWeeks });
        const { error: weekErr } = await supabase
          .from('program_weeks')
          .insert({ block_id: inserted.id, week_number: 1 });
        if (weekErr) throw weekErr;
        toast.success('Block created');
        const wList = await fetchWeeks(supabase, inserted.id);
        setWeeks(wList);
        if (wList.length > 0) setSelectedWeekIndex(0);
        navigate(`/program-builder?clientId=${encodeURIComponent(cId)}&blockId=${encodeURIComponent(inserted.id)}`, { replace: true });
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectWeek = (weekIndex) => {
    setSelectedWeekIndex(weekIndex);
    setSelectedDayIndex(0);
  };

  const handleAddDay = async () => {
    if (!supabase || !selectedWeek) return;
    const nextNum = days.length + 1;
    if (nextNum > 7) {
      toast.error('Max 7 days per week');
      return;
    }
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from('program_days')
        .insert({ week_id: selectedWeek.id, day_number: nextNum, title: `Day ${nextNum}` })
        .select('*')
        .single();
      if (error) throw error;
      setDays((d) => [...d, inserted]);
      setSelectedDayIndex(days.length);
      toast.success('Day added');
    } catch (e) {
      toast.error(e?.message || 'Failed to add day');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExercise = async () => {
    if (!supabase || !selectedDay) return;
    setSaving(true);
    try {
      const nextOrder = exercises.length;
      const { data: inserted, error } = await supabase
        .from('program_exercises')
        .insert({
          day_id: selectedDay.id,
          exercise_name: 'New exercise',
          sets: 3,
          reps: 10,
          sort_order: nextOrder,
        })
        .select('*')
        .single();
      if (error) throw error;
      setExercises((ex) => [...ex, inserted]);
      toast.success('Exercise added');
    } catch (e) {
      toast.error(e?.message || 'Failed to add exercise');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExercise = async (exerciseId, updates) => {
    if (!supabase || !exerciseId) return;
    const { error } = await supabase.from('program_exercises').update(updates).eq('id', exerciseId);
    if (error) toast.error('Update failed');
    else setExercises((ex) => ex.map((e) => (e.id === exerciseId ? { ...e, ...updates } : e)));
  };

  const handleRemoveExercise = async (exerciseId) => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('program_exercises').delete().eq('id', exerciseId);
      if (error) throw error;
      setExercises((ex) => ex.filter((e) => e.id !== exerciseId));
      toast.success('Removed');
    } catch (e) {
      toast.error(e?.message || 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveExercise = async (index, direction) => {
    if (!supabase || index === undefined || exercises.length === 0) return;
    const next = index + direction;
    if (next < 0 || next >= exercises.length) return;
    const reordered = [...exercises];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(next, 0, removed);
    setSaving(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('program_exercises').update({ sort_order: i }).eq('id', reordered[i].id);
      }
      setExercises(reordered.map((e, i) => ({ ...e, sort_order: i })));
    } catch (e) {
      toast.error('Reorder failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateExercise = async (exercise, index) => {
    if (!supabase || !selectedDay || index == null) return;
    setSaving(true);
    try {
      const insertOrder = index + 1;
      const { error: insertErr } = await supabase.from('program_exercises').insert({
        day_id: selectedDay.id,
        exercise_name: exercise.exercise_name || 'New exercise',
        sets: exercise.sets ?? 3,
        reps: exercise.reps ?? 10,
        percentage: exercise.percentage ?? null,
        notes: exercise.notes ?? null,
        sort_order: insertOrder,
      });
      if (insertErr) throw insertErr;
      for (let i = insertOrder; i < exercises.length; i++) {
        await supabase.from('program_exercises').update({ sort_order: i + 1 }).eq('id', exercises[i].id);
      }
      const exList = await fetchExercises(supabase, selectedDay.id);
      setExercises(exList);
      toast.success('Exercise duplicated');
    } catch (e) {
      toast.error(e?.message || 'Duplicate failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateDay = async () => {
    if (!supabase || !selectedWeek || !selectedDay) return;
    if (days.length >= 7) {
      toast.error('Max 7 days per week');
      return;
    }
    setSaving(true);
    try {
      const nextDayNum = days.length + 1;
      const { data: newDay, error: dayErr } = await supabase
        .from('program_days')
        .insert({
          week_id: selectedWeek.id,
          day_number: nextDayNum,
          title: `${selectedDay.title || `Day ${selectedDay.day_number}`} (copy)`,
        })
        .select('*')
        .single();
      if (dayErr) throw dayErr;
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        await supabase.from('program_exercises').insert({
          day_id: newDay.id,
          exercise_name: ex.exercise_name || 'New exercise',
          sets: ex.sets ?? 3,
          reps: ex.reps ?? 10,
          percentage: ex.percentage ?? null,
          notes: ex.notes ?? null,
          sort_order: i,
        });
      }
      const dList = await fetchDays(supabase, selectedWeek.id);
      setDays(dList);
      setSelectedDayIndex(dList.length - 1);
      setExercises(
        (await fetchExercises(supabase, newDay.id)).map((e, i) => ({ ...e, sort_order: i }))
      );
      toast.success('Day duplicated');
    } catch (e) {
      toast.error(e?.message || 'Duplicate day failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWeek1ToWeek = async (targetWeekNumber) => {
    if (!supabase || !block?.id || targetWeekNumber < 2 || targetWeekNumber > totalWeeks) return;
    const week1 = weeks.find((w) => w.week_number === 1);
    if (!week1) {
      toast.error('Week 1 not found');
      return;
    }
    setSaving(true);
    try {
      let targetWeek = weeks.find((w) => w.week_number === targetWeekNumber);
      if (!targetWeek) {
        const { data: inserted, error: weekErr } = await supabase
          .from('program_weeks')
          .insert({ block_id: block.id, week_number: targetWeekNumber })
          .select('*')
          .single();
        if (weekErr) throw weekErr;
        targetWeek = inserted;
        setWeeks((w) => [...w, inserted].sort((a, b) => a.week_number - b.week_number));
      }
      const week1Days = await fetchDays(supabase, week1.id);
      for (const day of week1Days) {
        const dayExercises = await fetchExercises(supabase, day.id);
        const { data: newDay, error: dayErr } = await supabase
          .from('program_days')
          .insert({
            week_id: targetWeek.id,
            day_number: day.day_number,
            title: day.title || `Day ${day.day_number}`,
          })
          .select('*')
          .single();
        if (dayErr) throw dayErr;
        for (let i = 0; i < dayExercises.length; i++) {
          const ex = dayExercises[i];
          await supabase.from('program_exercises').insert({
            day_id: newDay.id,
            exercise_name: ex.exercise_name || 'New exercise',
            sets: ex.sets ?? 3,
            reps: ex.reps ?? 10,
            percentage: ex.percentage ?? null,
            notes: ex.notes ?? null,
            sort_order: i,
          });
        }
      }
      toast.success(`Week 1 copied to Week ${targetWeekNumber}`);
    } catch (e) {
      toast.error(e?.message || 'Copy week failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
        <p style={{ color: colors.muted }}>Program Builder is for coaches only.</p>
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

  const saveDisabled = !blockName.trim() || (!clientId && !block?.client_id);

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Program Builder" onBack={() => navigate(-1)} />
      <div style={{ ...pageContainer, paddingBottom: spacing[24] }}>
        {adjustmentMode && contextBannerTitle && (
          <Card
            style={{
              marginBottom: spacing[16],
              padding: spacing[16],
              background: colors.primarySubtle,
              border: `1px solid ${colors.primary}`,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: 0 }}>
              {contextBannerTitle}
            </p>
            {contextNote && (
              <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: 4 }} title={contextNote}>
                {contextNote.length > 80 ? `${contextNote.slice(0, 80)}…` : contextNote}
              </p>
            )}
            <div
              className="flex flex-wrap gap-2"
              style={{ marginTop: spacing[12], paddingTop: spacing[12], borderTop: `1px solid ${shell.cardBorder}` }}
            >
              <button
                type="button"
                onClick={() => handleSaveBlock()}
                disabled={saveDisabled || saving}
                className="inline-flex items-center gap-1.5"
                style={{
                  padding: `${spacing[8]}px ${spacing[12]}px`,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: saveDisabled || saving ? 'not-allowed' : 'pointer',
                  opacity: saveDisabled || saving ? 0.7 : 1,
                }}
              >
                <Save size={14} /> Save changes
              </button>
              {block?.id && (clientId || block.client_id) && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/program-assignments?clientId=${encodeURIComponent(clientId || block.client_id)}&blockId=${encodeURIComponent(block.id)}`
                    )
                  }
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: `${spacing[8]}px ${spacing[12]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.primary,
                    border: `1px solid ${colors.primary}`,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <UserPlus size={14} /> Reassign updated plan
                </button>
              )}
              {(clientId || block?.client_id) && (
                <button
                  type="button"
                  onClick={() => navigate(`/clients/${clientId || block.client_id}`)}
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: `${spacing[8]}px ${spacing[12]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${shell.cardBorder}`,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <User size={14} /> Return to Client
                </button>
              )}
              {contextReviewId && (contextSource === 'checkin' || contextSource === 'pose_check') && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      contextSource === 'checkin'
                        ? `/review-center/checkins/${contextReviewId}`
                        : `/review-center/pose-checks/${contextReviewId}`
                    )
                  }
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: `${spacing[8]}px ${spacing[12]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${shell.cardBorder}`,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={14} /> Return to Review
                </button>
              )}
            </div>
          </Card>
        )}
        {!block && !clientId && clients.length > 0 && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Client</p>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{
                width: '100%',
                padding: `${spacing[12]}px ${spacing[14]}px`,
                borderRadius: 10,
                background: colors.surface2,
                border: `1px solid ${shell.cardBorder}`,
                color: colors.text,
                fontSize: 14,
              }}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Card>
        )}

        <BlockHeader
          blockName={blockName}
          onBlockNameChange={setBlockName}
          totalWeeks={totalWeeks}
          onTotalWeeksChange={setTotalWeeks}
          onSave={handleSaveBlock}
          saving={saving}
          saveDisabled={saveDisabled}
          hasBlock={!!block?.id}
          blockNamePlaceholder={isPrepOriented ? 'Block name (e.g. Prep Block)' : 'Block name'}
        />

        {block?.id && (clientId || block.client_id) && coachSuggestions.length > 0 && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8], display: 'flex', alignItems: 'center', gap: spacing[6] }}>
              <Lightbulb size={14} style={{ color: colors.primary }} />
              Smart suggestions
            </p>
            <ul className="space-y-1" style={{ margin: 0, paddingLeft: spacing[18] }}>
              {coachSuggestions.map((s, idx) => (
                <li key={idx} className="text-sm" style={{ color: colors.text }}>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {block?.id && (clientId || block.client_id) && (
          <div className="flex flex-wrap gap-2" style={{ marginBottom: sectionGap }}>
            <button
              type="button"
              onClick={() => navigate(`/program-assignments?blockId=${encodeURIComponent(block.id)}&clientId=${encodeURIComponent(clientId || block.client_id)}`)}
              className="inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-opacity"
              style={{
                padding: `${spacing[10]}px ${spacing[16]}px`,
                border: `1px solid ${colors.primary}`,
                background: 'transparent',
                color: colors.primary,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={18} /> Assign to client
            </button>
          </div>
        )}

        {!block?.id && (
          <p className="text-[13px]" style={{ color: colors.muted, marginBottom: sectionGap }}>
            Create the block to add weeks and days.
          </p>
        )}

        {block?.id && (
          <>
            <WeekTabs
              weeks={weeks}
              totalWeeks={totalWeeks}
              selectedWeekIndex={selectedWeekIndex}
              onSelectWeek={handleSelectWeek}
            />

            {selectedWeek?.week_number === 1 && weeks.find((w) => w.week_number === 1) && totalWeeks > 1 && (
              <div style={{ marginBottom: sectionGap }}>
                <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Copy Week 1 to</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.max(0, totalWeeks - 1) }, (_, i) => i + 2).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleCopyWeek1ToWeek(num)}
                      disabled={saving}
                      className="transition-opacity"
                      style={{
                        padding: `${spacing[8]}px ${spacing[14]}px`,
                        borderRadius: shell.cardRadius,
                        border: `1px solid ${shell.cardBorder}`,
                        background: 'transparent',
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      Week {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedWeek && (
              <>
                {days.length === 0 ? (
                  <div style={{ marginBottom: sectionGap }}>
                    <EmptyState
                      title="This week has no training days"
                      description="Add a day to define exercises and structure for this week. You can add multiple days (e.g. Day A, B, C) and assign them to the week."
                      icon={Calendar}
                      actionLabel="Add first day"
                      onAction={handleAddDay}
                    />
                  </div>
                ) : (
                  <>
                    <DayTabs
                      days={days}
                      selectedDayIndex={selectedDayIndex}
                      onSelectDay={setSelectedDayIndex}
                      onAddDay={handleAddDay}
                      onDuplicateDay={handleDuplicateDay}
                      addDayDisabled={saving}
                    />

                    {selectedDay && (
                      <ExerciseEditor
                        exercises={exercises}
                        onAddExercise={handleAddExercise}
                        onUpdateExercise={handleUpdateExercise}
                        onRemoveExercise={handleRemoveExercise}
                        onMoveExercise={handleMoveExercise}
                        onDuplicateExercise={handleDuplicateExercise}
                        notesPlaceholder={isPrepOriented ? 'Notes / RIR-RPE or cardio / posing (optional)' : 'Notes / RIR-RPE (optional)'}
                        saving={saving}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
