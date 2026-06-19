import React, { useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { parsePrescribedRepsForStorage, upsertSet } from '@/lib/workoutSessionApi';
import { loadUnitShortLabel } from '@/lib/trainingLoadUnits';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

function parseSetsConfig(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rirLabel(v) {
  if (v === 0) return "0 - Max effort - couldn't do another rep";
  if (v === 1) return '1 - 1 rep left in the tank';
  if (v === 2) return '2 - 2 reps left in the tank';
  if (v === 3) return '3 - 3+ reps left - felt easy';
  if (v === 4) return '4+ - Very easy / warm-up';
  return '';
}

const RIR_OPTIONS = [0, 1, 2, 3, 4];

const PLATE_SIZES = [20, 15, 10, 5, 2.5, 1.25];

function calcPlates(weightKg, barKg = 20) {
  const total = parseFloat(weightKg);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (total <= barKg) return { bar: total, perSide: [], total, barOnly: true };
  let remaining = Math.round(((total - barKg) / 2) * 1000) / 1000;
  const perSide = [];
  for (const p of PLATE_SIZES) {
    const n = Math.floor(remaining / p + 0.001);
    if (n > 0) {
      perSide.push({ weight: p, count: n });
      remaining = Math.round((remaining - n * p) * 1000) / 1000;
    }
  }
  return { bar: barKg, perSide, total, remainder: remaining > 0.05 ? remaining : 0 };
}

function PlateDisplay({ weightKg, barKg = 20 }) {
  const result = calcPlates(weightKg, barKg);
  if (!result) return null;
  return (
    <div style={{ background: '#1a1a2e', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#8b8ba0', lineHeight: 1.5 }}>
      {result.barOnly ? (
        <span>Bar only ({result.bar}kg)</span>
      ) : (
        <>
          <span style={{ fontWeight: 700, color: '#e0e0f0' }}>{result.bar}kg bar</span>
          {result.perSide.map(({ weight, count }) => (
            <span key={weight}> + {count > 1 ? `${count}×` : ''}{weight}kg</span>
          ))}
          <span style={{ opacity: 0.7 }}> each side</span>
          {result.remainder > 0 && (
            <span style={{ color: '#f59e0b' }}> (+{result.remainder}kg unmatched)</span>
          )}
        </>
      )}
    </div>
  );
}

const FLAG_QUICK_OPTIONS = [
  { label: "Can't do it today", note: "[FLAG] Could not perform this exercise today." },
  { label: 'Pain / injury', note: '[FLAG] Felt pain or discomfort — please review.' },
  { label: 'No equipment', note: '[FLAG] Equipment not available today.' },
  { label: 'Too heavy', note: '[FLAG] Weight felt too heavy — may need adjusting.' },
];

export default function ExerciseSetLogger({
  exercise,
  sessionId,
  sets = [],
  sessionSets = [],
  previousExercisePerf = {},
  previousSets = [],
  onSetComplete,
  onSetCompleted,
  onAllSetsComplete,
  warmupDismissed = false,
  onWarmupDismiss,
  warmupSets = [],
  completedWarmups = {},
  onDismissWarmups,
  onCompleteWarmup,
  showPreviousSession = false,
  viewerLoadUnit = 'kg',
}) {
  const [exerciseNote, setExerciseNote] = useState('');
  const [savingSet, setSavingSet] = useState(false);
  const [platesOpenForSet, setPlatesOpenForSet] = useState(null);
  const notesSavedRef = useRef('');

  const allSessionSets = Array.isArray(sessionSets) && sessionSets.length > 0 ? sessionSets : sets;
  const mergedPreviousSets = useMemo(() => {
    if (Array.isArray(previousSets) && previousSets.length > 0) return previousSets;
    return Object.entries(previousExercisePerf || {}).map(([set_number, vals]) => ({
      set_number: Number(set_number),
      ...(vals || {}),
    }));
  }, [previousSets, previousExercisePerf]);
  const effectiveWarmupSets = warmupDismissed ? [] : warmupSets;

  const configuredSets = useMemo(() => {
    const rows = parseSetsConfig(exercise?.sets_config);
    const count = Math.max(1, Number(exercise?.sets) || 1);
    if (!rows?.length) {
      const reps = exercise?.reps != null ? String(exercise.reps) : '';
      return Array.from({ length: count }, (_, i) => ({
        set_number: i + 1,
        weight_kg: null,
        reps,
        rir: null,
      }));
    }
    return rows.map((r, i) => ({ ...r, set_number: Number(r?.set_number) || i + 1 }));
  }, [exercise?.sets, exercise?.reps, exercise?.sets_config]);

  const completedMap = useMemo(() => {
    const map = new Map();
    for (const row of allSessionSets) {
      if (row?.exercise_id !== exercise?.id || row?.set_number == null) continue;
      map.set(Number(row.set_number), row);
    }
    return map;
  }, [allSessionSets, exercise?.id]);

  const previousSetMap = useMemo(() => {
    const map = new Map();
    for (const row of mergedPreviousSets || []) {
      const key = Number(row?.set_number ?? row?.setNumber);
      if (!Number.isFinite(key)) continue;
      map.set(key, row);
    }
    return map;
  }, [mergedPreviousSets]);

  const firstIncomplete = useMemo(
    () => configuredSets.findIndex((r) => !(completedMap.get(Number(r.set_number))?.completed)),
    [configuredSets, completedMap],
  );
  const activeIndex = firstIncomplete < 0 ? configuredSets.length - 1 : firstIncomplete;
  const allComplete = firstIncomplete < 0;

  const [draftBySet, setDraftBySet] = useState(() => ({}));
  const syncDraft = (setNumber, partial) => {
    setDraftBySet((prev) => ({ ...prev, [setNumber]: { ...(prev[setNumber] || {}), ...partial } }));
  };

  const saveExerciseNote = async (noteOverride) => {
    const note = String(noteOverride ?? exerciseNote ?? '').trim();
    if (!sessionId || !exercise?.id || !note || notesSavedRef.current === note) return;
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from('workout_exercise_notes').insert({
      session_id: sessionId,
      exercise_id: exercise.id,
      note,
    });
    if (!error) notesSavedRef.current = note;
  };

  const completeSet = async (row, rowIdx) => {
    if (!sessionId || !exercise?.id || savingSet) return;
    const setNumber = Number(row.set_number) || rowIdx + 1;
    const draft = draftBySet[setNumber] || {};
    const prescribedWeight = row?.weight_kg != null ? Number(row.weight_kg) : null;
    const prescribedRepsRaw = row?.reps != null ? String(row.reps) : String(exercise?.reps || '');
    const prescribedReps = parsePrescribedRepsForStorage(prescribedRepsRaw);
    const prescribedRir = row?.rir != null ? Number(row.rir) : null;
    const prev = previousSetMap.get(setNumber) ?? null;
    const weightDone = draft.weight !== '' && draft.weight != null
      ? Number(draft.weight)
      : (prev?.weight_done ?? prev?.weightDone) != null
        ? Number(prev?.weight_done ?? prev?.weightDone)
        : prescribedWeight;
    const repsDone = draft.reps !== '' && draft.reps != null
      ? Number(draft.reps)
      : prescribedReps;
    const rirDone = draft.rir != null ? Number(draft.rir) : null;
    if (!Number.isFinite(repsDone)) return;
    setSavingSet(true);
    await upsertSet(sessionId, {
      exercise_id: exercise.id,
      set_number: setNumber,
      completed: true,
      prescribed_weight: prescribedWeight,
      prescribed_reps: prescribedReps,
      prescribed_reps_raw: prescribedRepsRaw || null,
      prescribed_rir: prescribedRir,
      weight_done: Number.isFinite(weightDone) ? weightDone : null,
      reps_done: Number.isFinite(repsDone) ? repsDone : null,
      rir_done: Number.isFinite(rirDone) ? rirDone : null,
      client_notes: null,
    });
    await saveExerciseNote();
    setSavingSet(false);
    onSetCompleted?.({ setNumber, exerciseId: exercise.id });
    onSetComplete?.({ setNumber, exerciseId: exercise.id });
    const remaining = configuredSets.filter((s, idx) => idx > rowIdx).length;
    if (remaining === 0) onAllSetsComplete?.();
  };

  return (
    <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
      {Array.isArray(effectiveWarmupSets) && effectiveWarmupSets.length > 0 ? (
        <div style={{ marginBottom: spacing[12] }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[8] }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: colors.muted, margin: 0 }}>
              Warm-up sets (suggested)
            </p>
            <button type="button" onClick={() => { onDismissWarmups?.(); onWarmupDismiss?.(); }} style={{ fontSize: 11, color: colors.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
          {effectiveWarmupSets.map((set) => {
              const done = !!completedWarmups[`${exercise?.id}_${set.setNumber}`];
              return (
                <div key={set.setNumber} style={{ display: 'flex', alignItems: 'center', gap: spacing[12], padding: `${spacing[8]}px 0`, borderBottom: `0.5px solid ${colors.border}`, background: colors.surface1 }}>
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 32 }}>{set.setNumber}</span>
                  <span style={{ fontSize: 13, color: colors.muted, flex: 1 }}>
                    {set.weight_kg}kg × {set.reps}
                    <span style={{ fontSize: 11, color: colors.muted, marginLeft: 6 }}>({set.label})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onCompleteWarmup?.(set.setNumber)}
                    style={{ fontSize: 11, fontWeight: 500, color: done ? colors.success : colors.primary, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, padding: spacing[8] }}
                  >
                    {done ? '✓ Done' : 'Done'}
                  </button>
                </div>
              );
            })}
        </div>
      ) : null}
      {configuredSets.map((row, idx) => {
        const setNumber = Number(row.set_number) || idx + 1;
        const completed = completedMap.get(setNumber)?.completed;
        const warmupBlocking = Array.isArray(effectiveWarmupSets) && effectiveWarmupSets.length > 0 && effectiveWarmupSets.some((w) => !completedWarmups[`${exercise?.id}_${w.setNumber}`]);
        const active = !warmupBlocking && !completed && idx === activeIndex;
        const prevSet =
          previousSetMap.get(setNumber)
          ?? previousSetMap.get(String(setNumber))
          ?? null;
        const draft = draftBySet[setNumber] || {};
        const prevWeight = prevSet?.weight_done ?? prevSet?.weightDone ?? null;
        const prevReps = prevSet?.reps_done ?? prevSet?.repsDone ?? null;
        const suggestedWeight = prevWeight ?? row?.weight_kg ?? '';
        const suggestedReps = row?.reps ?? exercise?.reps ?? '';
        const prevDisplay = prevWeight != null
          ? `${prevWeight}${loadUnitShortLabel(viewerLoadUnit)} × ${prevReps ?? '—'}`
          : '—';
        const currentDraft = draftBySet[setNumber];
        const deltaWeight = currentDraft?.weight != null && prevWeight != null
          ? Number(currentDraft.weight) - Number(prevWeight) : null;
        const prescribedRir = row?.rir != null ? Number(row.rir) : null;
        const selectedRir = draft.rir != null ? Number(draft.rir) : null;
        const caution = (selectedRir === 0 || selectedRir === 1) && idx < 2;
        return (
          <div key={`set-log-${setNumber}`} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.card, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: spacing[10], background: colors.surface2, borderRight: `1px solid ${colors.border}` }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted }}>Set {setNumber} - Coach target</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, color: colors.text }}>
                  {row?.weight_kg != null ? `${row.weight_kg}kg` : 'bodyweight'} · {row?.reps || exercise?.reps || '—'} reps · RIR {prescribedRir ?? '—'}
                </p>
              </div>
              <div style={{ padding: spacing[10], background: colors.surface1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted }}>Your log</p>
                {completed ? (
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, color: colors.text }}>
                    {completedMap.get(setNumber)?.weight_done ?? '—'}kg · {completedMap.get(setNumber)?.reps_done ?? '—'} reps · RIR {completedMap.get(setNumber)?.rir_done ?? '—'}
                  </p>
                ) : active ? (
                  <div style={{ marginTop: spacing[6], display: 'grid', gap: spacing[8] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: showPreviousSession ? '1fr 1fr 72px' : '1fr 1fr', gap: spacing[6] }}>
                      <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, overflow: 'hidden', minHeight: touchTargetMin }}>
                        <button type="button" onPointerDown={(e) => { e.preventDefault(); const cur = parseFloat(draft.weight ?? suggestedWeight) || 0; syncDraft(setNumber, { weight: String(Math.max(0, Math.round((cur - 2.5) * 100) / 100) ) }); }} style={{ width: 34, background: 'transparent', border: 'none', borderRight: `1px solid ${colors.border}`, color: colors.muted, fontWeight: 700, fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>−</button>
                        <input value={draft.weight ?? suggestedWeight} onChange={(e) => syncDraft(setNumber, { weight: e.target.value })} placeholder={String(suggestedWeight || '')} style={{ scrollMarginBottom: 120, flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: colors.text, textAlign: 'center' }} />
                        <button type="button" onPointerDown={(e) => { e.preventDefault(); const cur = parseFloat(draft.weight ?? suggestedWeight) || 0; syncDraft(setNumber, { weight: String(Math.round((cur + 2.5) * 100) / 100) }); }} style={{ width: 34, background: 'transparent', border: 'none', borderLeft: `1px solid ${colors.border}`, color: colors.muted, fontWeight: 700, fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>+</button>
                      </div>
                      <input value={draft.reps ?? suggestedReps} onChange={(e) => syncDraft(setNumber, { reps: e.target.value.replace(/[^0-9]/g, '') })} placeholder={String(suggestedReps || '')} style={{ scrollMarginBottom: 120, minHeight: touchTargetMin, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, textAlign: 'center' }} />
                      {showPreviousSession ? (
                        <div style={{ display: 'grid', alignItems: 'center', justifyItems: 'center', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.muted, fontSize: 10 }}>
                          {prevDisplay}
                          {deltaWeight > 0 ? (
                            <span style={{ color: colors.success, fontSize: 11 }}>
                              ↑
                            </span>
                          ) : null}
                          {deltaWeight < 0 ? (
                            <span style={{ color: colors.warning, fontSize: 11 }}>
                              ↓
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Coach target: RIR {prescribedRir ?? '—'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: spacing[6] }}>
                      {RIR_OPTIONS.map((r) => (
                        <button
                          key={`rir-${setNumber}-${r}`}
                          type="button"
                          onClick={() => syncDraft(setNumber, { rir: r })}
                          style={{
                            minHeight: touchTargetMin,
                            borderRadius: 8,
                            border: `1px solid ${selectedRir === r ? colors.primary : colors.border}`,
                            background: selectedRir === r ? colors.primary : colors.surface2,
                            color: selectedRir === r ? '#fff' : colors.muted,
                            fontWeight: 700,
                          }}
                        >
                          {r === 4 ? '4+' : r}
                        </button>
                      ))}
                    </div>
                    {selectedRir != null ? <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>{rirLabel(selectedRir)}</p> : null}
                    {caution ? <p style={{ margin: 0, fontSize: 11, color: colors.warning }}>This felt close to max - coach may adjust next session</p> : null}
                    {(() => {
                      const currentWeightKg = parseFloat(draft.weight ?? suggestedWeight) || 0;
                      const platesOpen = platesOpenForSet === setNumber;
                      if (currentWeightKg <= 0) return null;
                      return (
                        <div>
                          <button
                            type="button"
                            onClick={() => setPlatesOpenForSet(platesOpen ? null : setNumber)}
                            style={{ fontSize: 11, color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: platesOpen ? spacing[4] : 0 }}
                          >
                            {platesOpen ? 'Hide plates' : '🏋️ Show plates'}
                          </button>
                          {platesOpen && <PlateDisplay weightKg={currentWeightKg} />}
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => completeSet(row, idx)}
                      disabled={savingSet}
                      style={{
                        minHeight: touchTargetMin,
                        borderRadius: radii.button,
                        border: 'none',
                        background: colors.primary,
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      {savingSet ? 'Saving…' : 'Log set ✓'}
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                    {warmupBlocking ? 'Complete warm-up sets first' : 'Complete previous sets first'}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: spacing[6] }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 600 }}>Note for your coach</p>
          <div style={{ display: 'flex', gap: spacing[4], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {FLAG_QUICK_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setExerciseNote(opt.note);
                  saveExerciseNote(opt.note);
                }}
                style={{
                  fontSize: 10,
                  padding: `3px ${spacing[6]}px`,
                  borderRadius: 20,
                  border: `1px solid ${exerciseNote === opt.note ? colors.warning : colors.border}`,
                  background: exerciseNote === opt.note ? 'rgba(245,158,11,0.12)' : colors.surface2,
                  color: exerciseNote === opt.note ? colors.warning : colors.muted,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          value={exerciseNote}
          onChange={(e) => setExerciseNote(e.target.value)}
          onBlur={saveExerciseNote}
          placeholder="e.g. felt too heavy, left shoulder tight, easy today..."
          style={{
            width: '100%',
            minHeight: touchTargetMin,
            borderRadius: 10,
            border: `1px solid ${exerciseNote.startsWith('[FLAG]') ? colors.warning : colors.border}`,
            background: colors.surface2,
            color: colors.text,
            padding: `0 ${spacing[10]}px`,
          }}
        />
        {exerciseNote.startsWith('[FLAG]') && (
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.warning }}>
            Your coach will see this flag when they review your session.
          </p>
        )}
      </div>
    </div>
  );
}
