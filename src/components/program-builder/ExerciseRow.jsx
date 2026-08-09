/**
 * Single exercise: a compact tappable row (name + set/rep/rest summary) that
 * expands to the full editor (targets, notes, advanced). Collapsed by default so
 * a day reads as a clean list; new/blank exercises open automatically.
 */
import React, { useState, memo, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, Trash2, Copy, SlidersHorizontal, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { impactLight, selectionChanged } from '@/lib/haptics';
import { EXERCISES as LIB_EXERCISES } from '@/data/exercises/exerciseLibrary';
import { getPosesForExercise } from '@/lib/data/poseLibraryData';
import { PREP_EDUCATION_OPTIONS } from '@/lib/prepEducationContent';

const INPUT_PADDING = { padding: `${spacing[10]}px ${spacing[12]}px` };
const baseInputStyle = {
  ...INPUT_PADDING,
  borderRadius: 10,
  fontSize: 14,
  background: colors.surface2,
  color: colors.text,
};

function getInputStyle(borderColor = shell.cardBorder) {
  return { ...baseInputStyle, border: `1px solid ${borderColor}` };
}

function parseStepperInt(raw, minVal) {
  if (raw === '' || raw == null) return null;
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(minVal, n);
}

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

function isValidTempoInput(raw) {
  if (raw == null || raw === '') return true;
  return /^\d+-\d+-\d+$/.test(String(raw).trim());
}

function tempoPreview(raw) {
  if (!raw || !isValidTempoInput(raw)) return '';
  const [eccentric, pause, concentric] = String(raw).split('-').map((n) => Number(n));
  return `${eccentric}s down · ${pause}s pause · ${concentric}s up`;
}

function estimateTryWeightKg(exerciseName, experienceLevel) {
  const name = String(exerciseName || '').toLowerCase();
  const level = String(experienceLevel || 'intermediate').toLowerCase();
  const benchLike = /bench|press/.test(name);
  const squatLike = /squat|leg press/.test(name);
  const deadliftLike = /deadlift|rdl|hinge/.test(name);
  const rowLike = /row|pulldown|pull-up|chin-up/.test(name);
  const map = {
    beginner: { bench: 40, squat: 50, deadlift: 60, row: 35, base: 25 },
    intermediate: { bench: 60, squat: 80, deadlift: 100, row: 50, base: 35 },
    advanced: { bench: 90, squat: 120, deadlift: 150, row: 70, base: 45 },
  };
  const profile = map[level] || map.intermediate;
  if (benchLike) return profile.bench;
  if (squatLike) return profile.squat;
  if (deadliftLike) return profile.deadlift;
  if (rowLike) return profile.row;
  return profile.base;
}

function buildDefaultSetsConfig(exercise, options = {}) {
  const count = Math.max(1, Number(exercise?.sets) || 1);
  const reps = exercise?.reps != null ? String(exercise.reps) : '';
  const defaultWeight = options.lastWeight ?? null;
  return Array.from({ length: count }, (_, i) => ({
    set_number: i + 1,
    weight_kg: defaultWeight,
    reps,
    rir: null,
    notes: '',
  }));
}

function formatWeeksAgo(dateIso) {
  if (!dateIso) return null;
  const when = new Date(dateIso);
  if (Number.isNaN(when.getTime())) return null;
  const diffMs = Date.now() - when.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(0, Math.round(diffMs / weekMs));
  if (weeks <= 0) return 'this week';
  if (weeks === 1) return '1 week ago';
  return `${weeks} weeks ago`;
}

function StepperField({ value, placeholder, onChange, min = 0, ariaLabel, invalid = false }) {
  const dupGuard = useRef({ raw: null, open: false });
  // While the user is typing, the DOM text is owned by this draft — parent
  // re-renders (per-keystroke autosave responses landing out of order) used
  // to force the controlled value back mid-word: typing "120" produced "10".
  const [draft, setDraft] = useState(null);
  const focused = draft !== null;
  const numFromValue = value != null && value !== '' ? Number(value) : NaN;
  const current = Number.isFinite(numFromValue) ? numFromValue : null;
  const nextDown = current == null ? min : Math.max(min, current - 1);
  const nextUp = current == null ? Math.max(min, 1) : current + 1;

  const applyRaw = (raw) => {
    const g = dupGuard.current;
    if (g.open && g.raw === raw) return;
    g.raw = raw;
    g.open = true;
    queueMicrotask(() => {
      g.open = false;
    });
    const parsed = parseStepperInt(raw, min);
    onChange(parsed);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: 6, alignItems: 'center', position: 'relative', zIndex: 1 }}>
      <button
        type="button"
        onClick={() => {
          setDraft(null);
          onChange(nextDown);
          void impactLight();
        }}
        style={{ border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.surface1, color: colors.text, height: 36, fontWeight: 700, touchAction: 'manipulation' }}
        aria-label={`${ariaLabel} minus`}
      >
        -
      </button>
      <input
        type="number"
        step={1}
        placeholder={placeholder}
        min={min}
        value={focused ? draft : (value ?? '')}
        onFocus={(e) => {
          setDraft(e.target.value ?? '');
          e.target.select();
        }}
        onBlur={() => setDraft(null)}
        onChange={(e) => { setDraft(e.target.value); applyRaw(e.target.value); }}
        onInput={(e) => { setDraft(e.currentTarget.value); applyRaw(e.currentTarget.value); }}
        style={{ ...getInputStyle(invalid ? colors.danger : shell.cardBorder), width: '100%', textAlign: 'center', padding: `${spacing[8]}px ${spacing[8]}px` }}
        aria-label={ariaLabel}
        aria-invalid={invalid}
      />
      <button
        type="button"
        onClick={() => {
          setDraft(null);
          onChange(nextUp);
          void impactLight();
        }}
        style={{ border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.surface1, color: colors.text, height: 36, fontWeight: 700, touchAction: 'manipulation' }}
        aria-label={`${ariaLabel} plus`}
      >
        +
      </button>
    </div>
  );
}

const fieldLabel = { fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted, marginBottom: 4 };

function ExerciseRowInner({
  exercise,
  index,
  totalCount,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onCopyPrevious,
  hasPrevious = false,
  suggestions = [],
  previousPerformance = null,
  notesPlaceholder = 'Notes (optional)',
  saving,
  personalEditorMode = 'default',
  personalExperienceLevel = 'intermediate',
  onSmartSwap,
  showPrepEducationPicker = false,
  isAssignedProgramLive = false,
  supersetOptions = [],
  onLinkSuperset,
  onRemoveSuperset,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedSetRowIndex, setSelectedSetRowIndex] = useState(null);
  // Collapsed by default so a day reads as a clean list. New/blank exercises
  // (no name yet, or no sets configured) open so they can be filled in.
  const [expanded, setExpanded] = useState(() => {
    const noName = !String(exercise.exercise_name || '').trim() || exercise.exercise_name === 'New exercise';
    const noSets = exercise.sets == null || exercise.sets === '';
    return noName || noSets;
  });
  const exerciseLibraryId = useMemo(() => {
    const raw = exercise.exercise_library_id;
    if (raw) return String(raw);
    const n = String(exercise.exercise_name || '').trim().toLowerCase();
    if (!n) return '';
    const hit = LIB_EXERCISES.find((e) => String(e.name || '').trim().toLowerCase() === n);
    return hit?.id ? String(hit.id) : '';
  }, [exercise.exercise_library_id, exercise.exercise_name]);

  const poseTrainingHits = useMemo(
    () => (exerciseLibraryId ? getPosesForExercise(exerciseLibraryId) : []),
    [exerciseLibraryId],
  );

  const isPersonalBasic = personalEditorMode === 'personal_basic';
  const isPersonalEnhanced = personalEditorMode === 'personal_enhanced';
  const canMoveUp = index > 0 && !saving;
  const canMoveDown = index < totalCount - 1 && !saving;
  const nameEmpty = !String(exercise.exercise_name || '').trim();
  const setsNum = exercise.sets != null && exercise.sets !== '' ? Number(exercise.sets) : null;
  const repsNum = exercise.reps != null && exercise.reps !== '' ? Number(exercise.reps) : null;
  const setsInvalid = setsNum !== null && (isNaN(setsNum) || setsNum < 0);
  const repsInvalid = repsNum !== null && (isNaN(repsNum) || repsNum < 0);
  const prescribedWeightRaw =
    exercise?.prescribed_weight
    ?? exercise?.prescribed_weight_kg
    ?? exercise?.target_weight
    ?? exercise?.target_weight_kg
    ?? exercise?.load_kg
    ?? exercise?.weight
    ?? null;
  const prescribedWeight = prescribedWeightRaw == null ? null : Number(prescribedWeightRaw);
  const lastWeight = previousPerformance?.weight == null ? null : Number(previousPerformance.weight);
  const lastReps = previousPerformance?.reps == null ? null : Number(previousPerformance.reps);
  const lastDateText = formatWeeksAgo(previousPerformance?.date);
  const currentSetsConfig = useMemo(() => parseSetsConfig(exercise?.sets_config), [exercise?.sets_config]);
  const individualTargetsEnabled = Array.isArray(currentSetsConfig) && currentSetsConfig.length > 0;
  const tryWeightKg = useMemo(
    () => estimateTryWeightKg(exercise?.exercise_name, personalExperienceLevel),
    [exercise?.exercise_name, personalExperienceLevel],
  );
  const tempoValue = String(exercise?.tempo || '').trim();
  const tempoValid = isValidTempoInput(tempoValue);
  const tempoHint = tempoPreview(tempoValue);
  const showTempoBadge = tempoValue && tempoValid;
  const showSupersetBadge = !!exercise?.superset_group;
  const showWarmupBadge = !!exercise?.is_warmup_parent;

  const summaryText = (() => {
    if (individualTargetsEnabled) {
      const n = (currentSetsConfig || []).length;
      return `${n} set${n === 1 ? '' : 's'} · custom targets`;
    }
    const parts = [];
    if (setsNum != null && repsNum != null) parts.push(`${setsNum} × ${repsNum}`);
    else if (setsNum != null) parts.push(`${setsNum} set${setsNum === 1 ? '' : 's'}`);
    else if (repsNum != null) parts.push(`${repsNum} reps`);
    if (!isPersonalBasic && exercise.rest_seconds != null && exercise.rest_seconds !== '') {
      parts.push(`${exercise.rest_seconds}s rest`);
    }
    return parts.join(' · ') || 'Tap to set targets';
  })();

  const displayName = String(exercise.exercise_name || '').trim();

  const toggleAdvanced = () => {
    impactLight();
    setShowAdvanced((v) => !v);
  };

  const updateSetsConfig = (nextRows) => {
    const normalized = nextRows.map((row, idx) => ({
      set_number: idx + 1,
      weight_kg: row.weight_kg == null || row.weight_kg === '' ? null : Number(row.weight_kg),
      reps: row.reps == null ? '' : String(row.reps),
      rir: row.rir == null || row.rir === '' ? null : Number(row.rir),
      notes: row.notes ? String(row.notes) : '',
    }));
    onUpdate(exercise.id, {
      sets_config: normalized,
      sets: normalized.length,
      reps: normalized[0]?.reps || exercise?.reps || null,
    });
  };

  const toggleIndividualTargets = () => {
    if (individualTargetsEnabled) {
      onUpdate(exercise.id, { sets_config: null });
      return;
    }
    onUpdate(exercise.id, { sets_config: buildDefaultSetsConfig(exercise, { lastWeight }) });
  };

  const updateSetCell = (rowIdx, key, value) => {
    const rows = [...(currentSetsConfig || buildDefaultSetsConfig(exercise, { lastWeight }))];
    const row = { ...(rows[rowIdx] || {}) };
    row[key] = value;
    rows[rowIdx] = row;
    updateSetsConfig(rows);
  };

  const addSetAfter = (rowIdx) => {
    const rows = [...(currentSetsConfig || buildDefaultSetsConfig(exercise, { lastWeight }))];
    const source = rows[rowIdx] || { weight_kg: null, reps: '', rir: null, notes: '' };
    rows.splice(rowIdx + 1, 0, {
      set_number: rowIdx + 2,
      weight_kg: source.weight_kg ?? null,
      reps: source.reps ?? '',
      rir: source.rir ?? null,
      notes: source.notes ?? '',
    });
    updateSetsConfig(rows);
    setSelectedSetRowIndex(rowIdx + 1);
  };

  const duplicateSetRow = (rowIdx) => {
    const rows = [...(currentSetsConfig || buildDefaultSetsConfig(exercise, { lastWeight }))];
    const source = rows[rowIdx] || { weight_kg: null, reps: '', rir: null, notes: '' };
    rows.splice(rowIdx + 1, 0, {
      set_number: rowIdx + 2,
      weight_kg: source.weight_kg ?? null,
      reps: source.reps ?? '',
      rir: source.rir ?? null,
      notes: source.notes ?? '',
    });
    updateSetsConfig(rows);
  };

  const fillDownFromRow = (rowIdx) => {
    const rows = [...(currentSetsConfig || buildDefaultSetsConfig(exercise, { lastWeight }))];
    const source = rows[rowIdx];
    if (!source) return;
    for (let i = rowIdx + 1; i < rows.length; i += 1) {
      rows[i] = {
        ...rows[i],
        weight_kg: source.weight_kg ?? null,
        reps: source.reps ?? '',
        rir: source.rir ?? null,
      };
    }
    updateSetsConfig(rows);
  };

  return (
    <motion.div
      data-exercise-row-id={exercise?.id || ''}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <Card style={{ ...standardCard, padding: spacing[12], border: `1px solid ${colors.border}` }}>
        {/* Header row — always visible */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5 shrink-0">
            <motion.button
              type="button"
              onClick={async () => {
                if (!canMoveUp) return;
                await selectionChanged();
                onMoveUp(index);
              }}
              disabled={!canMoveUp}
              whileTap={{ scale: canMoveUp ? 0.9 : 1 }}
              aria-label="Move up"
              className="rounded p-1"
              style={{ color: colors.muted, cursor: canMoveUp ? 'pointer' : 'not-allowed', background: 'none', border: 'none', opacity: canMoveUp ? 1 : 0.35 }}
            >
              <ChevronUp size={16} />
            </motion.button>
            <motion.button
              type="button"
              onClick={async () => {
                if (!canMoveDown) return;
                await selectionChanged();
                onMoveDown(index);
              }}
              disabled={!canMoveDown}
              whileTap={{ scale: canMoveDown ? 0.9 : 1 }}
              aria-label="Move down"
              className="rounded p-1"
              style={{ color: colors.muted, cursor: canMoveDown ? 'pointer' : 'not-allowed', background: 'none', border: 'none', opacity: canMoveDown ? 1 : 0.35 }}
            >
              <ChevronDown size={16} />
            </motion.button>
          </div>

          {expanded ? (
            <input
              type="text"
              placeholder="Exercise name"
              value={exercise.exercise_name || ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onUpdate(exercise.id, { exercise_name: e.target.value })}
              list={`exercise-suggestions-${exercise.id}`}
              style={{ ...getInputStyle(nameEmpty ? colors.danger : shell.cardBorder), flex: 1, minWidth: 0, fontWeight: 600 }}
              aria-label="Exercise name"
              aria-invalid={nameEmpty}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                void impactLight();
                setExpanded(true);
              }}
              className="flex-1 min-w-0 text-left"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              aria-expanded={false}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: nameEmpty ? colors.muted : colors.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName || 'New exercise'}
              </div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{summaryText}</div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void impactLight();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? 'Collapse exercise' : 'Expand exercise'}
            className="rounded-lg p-1.5 shrink-0"
            style={{ color: colors.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <motion.button
            type="button"
            onClick={async () => {
              await impactLight();
              onRemove(exercise.id);
            }}
            disabled={saving}
            whileTap={{ scale: saving ? 1 : 0.92 }}
            aria-label="Remove exercise"
            className="rounded-lg p-1.5 shrink-0"
            style={{ color: colors.muted, cursor: saving ? 'wait' : 'pointer', background: 'none', border: 'none', opacity: saving ? 0.6 : 1 }}
          >
            <Trash2 size={18} />
          </motion.button>
        </div>

        {/* Collapsed badges (compact) */}
        {!expanded && (showTempoBadge || showSupersetBadge || showWarmupBadge) ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingLeft: 32 }}>
            {showTempoBadge ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 999, padding: '2px 8px' }}>[T]</span>
            ) : null}
            {showSupersetBadge ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.warning, border: `1px solid ${colors.warning}`, borderRadius: 999, padding: '2px 8px' }}>[S] {String(exercise.superset_group || '').toUpperCase()}</span>
            ) : null}
            {showWarmupBadge ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.success, border: `1px solid ${colors.success}`, borderRadius: 999, padding: '2px 8px' }}>[W]</span>
            ) : null}
          </div>
        ) : null}

        {/* Expanded editor body */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="flex flex-col gap-3" style={{ marginTop: spacing[12] }}>
                {(showTempoBadge || showSupersetBadge || showWarmupBadge) ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {showTempoBadge ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 999, padding: '2px 8px' }}>[T]</span>
                    ) : null}
                    {showSupersetBadge ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.warning, border: `1px solid ${colors.warning}`, borderRadius: 999, padding: '2px 8px' }}>[S] {String(exercise.superset_group || '').toUpperCase()}</span>
                    ) : null}
                    {showWarmupBadge ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.success, border: `1px solid ${colors.success}`, borderRadius: 999, padding: '2px 8px' }}>[W]</span>
                    ) : null}
                  </div>
                ) : null}
                <datalist id={`exercise-suggestions-${exercise.id}`}>
                  {(suggestions || []).slice(0, 12).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {poseTrainingHits.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] leading-snug" style={{ color: colors.muted, margin: 0 }}>
                      <span style={{ fontWeight: 600, color: colors.text }}>Builds stage shots:</span>{' '}
                      {poseTrainingHits.map((h, idx) => (
                        <span key={h.poseId}>
                          {idx > 0 ? ' · ' : ''}
                          <Link
                            to={`/comp-prep/poses/${encodeURIComponent(h.poseId)}`}
                            title={h.interpretation}
                            onClick={() => void impactLight()}
                            className="underline-offset-2 hover:underline"
                            style={{ color: colors.accent, fontWeight: 600 }}
                          >
                            {h.poseName}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                {nameEmpty && (
                  <p className="text-[11px]" style={{ color: colors.danger, margin: 0, opacity: 0.9 }}>
                    Name required
                  </p>
                )}

                {!individualTargetsEnabled ? (
                  <div className="grid gap-2" style={{ gridTemplateColumns: isPersonalBasic ? '1fr 1fr' : '1fr 1fr 1fr' }}>
                    <div>
                      <p style={fieldLabel}>Sets</p>
                      <StepperField
                        placeholder="—"
                        min={0}
                        value={exercise.sets}
                        onChange={(n) => onUpdate(exercise.id, { sets: n })}
                        ariaLabel="Sets"
                        invalid={setsInvalid}
                      />
                    </div>
                    <div>
                      <p style={fieldLabel}>Reps</p>
                      <StepperField
                        placeholder="—"
                        min={0}
                        value={exercise.reps}
                        onChange={(n) => onUpdate(exercise.id, { reps: n })}
                        ariaLabel="Reps"
                        invalid={repsInvalid}
                      />
                    </div>
                    {!isPersonalBasic && (
                      <div>
                        <p style={fieldLabel}>Rest (s)</p>
                        <StepperField
                          placeholder="—"
                          min={0}
                          value={exercise.rest_seconds}
                          onChange={(n) => onUpdate(exercise.id, { rest_seconds: n })}
                          ariaLabel="Rest seconds"
                        />
                      </div>
                    )}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => !individualTargetsEnabled && onUpdate(exercise.id, { sets_config: null })}
                    style={{
                      border: `1px solid ${!individualTargetsEnabled ? colors.primary : colors.border}`,
                      background: !individualTargetsEnabled ? colors.primarySubtle : colors.surface1,
                      color: !individualTargetsEnabled ? colors.primary : colors.text,
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 10px',
                    }}
                  >
                    Same targets for all sets
                  </button>
                  <button
                    type="button"
                    onClick={toggleIndividualTargets}
                    style={{
                      border: `1px solid ${individualTargetsEnabled ? colors.primary : colors.border}`,
                      background: individualTargetsEnabled ? colors.primarySubtle : colors.surface1,
                      color: individualTargetsEnabled ? colors.primary : colors.text,
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 10px',
                    }}
                  >
                    Per-set targets
                  </button>
                </div>
                {individualTargetsEnabled ? (
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    {isPersonalBasic || isPersonalEnhanced ? (
                      <p style={{ margin: 0, padding: '8px 10px', fontSize: 11, color: colors.muted, borderBottom: `1px solid ${colors.border}`, background: colors.surface1 }}>
                        {lastWeight != null
                          ? `Last session: ${lastWeight}kg${lastReps != null ? ` × ${lastReps}` : ''}`
                          : `Try ${tryWeightKg}kg to start, then adjust as needed.`}
                      </p>
                    ) : null}
                    <div style={{ display: 'grid', gridTemplateColumns: '54px 88px 84px 70px 1fr', gap: 6, padding: 8, background: colors.surface2, fontSize: 11, color: colors.muted, fontWeight: 700 }}>
                      <div>Set</div>
                      <div>Weight</div>
                      <div>Reps</div>
                      <div>RIR</div>
                      <div>Notes</div>
                    </div>
                    {(currentSetsConfig || []).map((row, rowIdx) => (
                      <div key={`set-row-${rowIdx}`} onClick={() => setSelectedSetRowIndex(rowIdx)} style={{ display: 'grid', gridTemplateColumns: '54px 88px 84px 70px 1fr', gap: 6, padding: 8, borderTop: `1px solid ${colors.border}` }}>
                        <div style={{ fontSize: 12, color: colors.muted, display: 'flex', alignItems: 'center' }}>{rowIdx + 1}</div>
                        <input value={row.weight_kg ?? ''} onChange={(e) => updateSetCell(rowIdx, 'weight_kg', e.target.value === '' ? null : Number(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSetAfter(rowIdx); } }} placeholder={lastWeight == null && rowIdx === 0 ? `Try ${tryWeightKg}` : 'kg'} style={{ ...getInputStyle(), fontSize: 12, padding: '6px 8px' }} />
                        <input value={row.reps ?? ''} onChange={(e) => updateSetCell(rowIdx, 'reps', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSetAfter(rowIdx); } }} placeholder="8-12" style={{ ...getInputStyle(), fontSize: 12, padding: '6px 8px' }} />
                        <input value={row.rir ?? ''} onChange={(e) => updateSetCell(rowIdx, 'rir', e.target.value === '' ? null : Number(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSetAfter(rowIdx); } }} placeholder="2" style={{ ...getInputStyle(), fontSize: 12, padding: '6px 8px' }} />
                        <input value={row.notes ?? ''} onChange={(e) => updateSetCell(rowIdx, 'notes', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSetAfter(rowIdx); } }} placeholder="Optional" style={{ ...getInputStyle(), fontSize: 12, padding: '6px 8px' }} />
                      </div>
                    ))}
                    <button type="button" onClick={() => addSetAfter(Math.max(0, (currentSetsConfig || []).length - 1))} style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: `1px solid ${colors.border}`, background: colors.surface1, color: colors.primary, fontWeight: 700, fontSize: 12, padding: '8px 10px' }}>
                      + Add set
                    </button>
                    {selectedSetRowIndex != null ? (
                      <div style={{ display: 'flex', gap: 8, padding: 8, borderTop: `1px solid ${colors.border}`, background: colors.surface2 }}>
                        <button type="button" onClick={() => duplicateSetRow(selectedSetRowIndex)} style={{ border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, borderRadius: 8, fontSize: 12, fontWeight: 600, padding: '6px 10px' }}>Duplicate</button>
                        <button type="button" onClick={() => fillDownFromRow(selectedSetRowIndex)} style={{ border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, borderRadius: 8, fontSize: 12, fontWeight: 600, padding: '6px 10px' }}>Fill down from here</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {lastWeight != null && (
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>
                      Last logged: {lastWeight}kg{lastReps != null ? ` × ${lastReps} reps` : ''}{lastDateText ? ` (${lastDateText})` : ''}
                    </p>
                    {prescribedWeight != null ? (
                      prescribedWeight < lastWeight ? (
                        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: '#b67a2a' }}>
                          ⚠ Target is below {isPersonalBasic || isPersonalEnhanced ? 'your' : 'their'} last logged weight
                        </p>
                      ) : prescribedWeight > lastWeight ? (
                        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.success }}>
                          ↑ Progressive overload
                        </p>
                      ) : null
                    ) : null}
                  </div>
                )}

                <div>
                  <p style={fieldLabel}>Notes</p>
                  <input
                    type="text"
                    placeholder={notesPlaceholder}
                    value={exercise.notes || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => onUpdate(exercise.id, { notes: e.target.value || null })}
                    style={{ ...getInputStyle(), width: '100%', fontSize: 13 }}
                    aria-label="Notes"
                  />
                </div>
                {isAssignedProgramLive ? (
                  <div>
                    <p style={fieldLabel}>Reason for change (optional — client will see this)</p>
                    <input
                      type="text"
                      placeholder="Reason for change"
                      value={exercise.coach_update_note || ''}
                      onChange={(e) => onUpdate(exercise.id, { coach_update_note: e.target.value || null })}
                      style={{ ...getInputStyle(), width: '100%', fontSize: 13 }}
                      aria-label="Reason for change"
                    />
                  </div>
                ) : null}

                {showPrepEducationPicker ? (
                  <div>
                    <p style={fieldLabel}>Add reason for this change</p>
                    <select
                      aria-label="Prep education tag"
                      value={exercise.prep_instruction_explanation_key || ''}
                      onChange={(e) =>
                        onUpdate(exercise.id, {
                          prep_instruction_explanation_key: e.target.value ? e.target.value : null,
                        })
                      }
                      style={{ ...getInputStyle(), width: '100%', fontSize: 13 }}
                    >
                      <option value="">None</option>
                      {PREP_EDUCATION_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <motion.button
                    type="button"
                    onClick={toggleAdvanced}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-lg"
                    style={{ color: colors.muted, border: `1px solid ${colors.border}`, background: colors.surface1 }}
                  >
                    <SlidersHorizontal size={14} />
                    {showAdvanced ? 'Hide advanced' : 'Advanced'}
                  </motion.button>
                  <div className="flex items-center gap-1.5">
                    {hasPrevious && (
                      <motion.button
                        type="button"
                        onClick={async () => {
                          await impactLight();
                          onCopyPrevious?.(exercise.id);
                        }}
                        disabled={saving}
                        whileTap={{ scale: saving ? 1 : 0.97 }}
                        className="text-xs font-semibold px-2.5 py-2 rounded-lg"
                        style={{ color: colors.text, border: `1px solid ${colors.border}`, background: colors.surface1, opacity: saving ? 0.6 : 1 }}
                      >
                        Copy prev
                      </motion.button>
                    )}
                    {onDuplicate && (
                      <motion.button
                        type="button"
                        onClick={async () => {
                          await impactLight();
                          onDuplicate(exercise, index);
                        }}
                        disabled={saving}
                        whileTap={{ scale: saving ? 1 : 0.97 }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-lg"
                        style={{ color: colors.text, border: `1px solid ${colors.border}`, background: colors.surface1, opacity: saving ? 0.6 : 1 }}
                      >
                        <Copy size={12} />
                        Duplicate
                      </motion.button>
                    )}
                    {isPersonalEnhanced && typeof onSmartSwap === 'function' && (
                      <motion.button
                        type="button"
                        onClick={async () => {
                          await impactLight();
                          onSmartSwap(exercise);
                        }}
                        disabled={saving}
                        whileTap={{ scale: saving ? 1 : 0.97 }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-lg"
                        style={{ color: colors.primary, border: `1px solid ${colors.primary}`, background: colors.primarySubtle, opacity: saving ? 0.6 : 1 }}
                      >
                        <Sparkles size={12} />
                        Smart swap
                      </motion.button>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {showAdvanced && (
                    <motion.div
                      key="adv"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="grid gap-2.5 p-3 rounded-xl" style={{ border: `1px solid ${colors.border}`, background: colors.surface1 }}>
                        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                          <div>
                            <p style={fieldLabel}>Rest (s)</p>
                            <StepperField
                              placeholder="—"
                              min={0}
                              value={exercise.rest_seconds}
                              onChange={(n) => onUpdate(exercise.id, { rest_seconds: n })}
                              ariaLabel="Rest seconds"
                            />
                          </div>
                          <div>
                            <p style={fieldLabel}>RPE</p>
                            <StepperField
                              placeholder="—"
                              min={0}
                              value={exercise.rpe}
                              onChange={(n) => onUpdate(exercise.id, { rpe: n })}
                              ariaLabel="RPE"
                            />
                          </div>
                          <div>
                            <p style={fieldLabel}>Tempo (optional)</p>
                            <input
                              type="text"
                              placeholder="e.g. 3-1-1"
                              value={tempoValue}
                              onChange={(e) => {
                                const next = String(e.target.value || '').replace(/[^\d-]/g, '');
                                onUpdate(exercise.id, { tempo: next || null });
                              }}
                              style={{ ...getInputStyle(!tempoValid ? colors.danger : shell.cardBorder), width: '100%', fontSize: 13, padding: `${spacing[8]}px ${spacing[8]}px` }}
                              aria-label="Tempo"
                            />
                            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.muted }}>
                              eccentric - pause - concentric
                            </p>
                            {tempoHint ? (
                              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.textSecondary }}>
                                {tempoHint}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Load %"
                          value={exercise.percentage != null ? String(exercise.percentage) : ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            onUpdate(exercise.id, {
                              percentage: e.target.value === '' ? null : parseFloat(e.target.value),
                            })
                          }
                          style={{ ...getInputStyle(), width: '100%' }}
                          aria-label="Load or percentage"
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: spacing[8], alignItems: 'end' }}>
                          <div>
                            <p style={fieldLabel}>Superset</p>
                            <select
                              value=""
                              onChange={(e) => {
                                const partnerId = e.target.value;
                                if (partnerId) onLinkSuperset?.(exercise.id, partnerId);
                              }}
                              style={{ ...getInputStyle(), width: '100%' }}
                            >
                              <option value="">Link to superset {'->'}</option>
                              {(supersetOptions || []).map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          {showSupersetBadge ? (
                            <button
                              type="button"
                              onClick={() => onRemoveSuperset?.(exercise.id)}
                              style={{ border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, borderRadius: 8, minHeight: 36, padding: '0 10px', fontSize: 12, fontWeight: 600 }}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(exercise?.is_warmup_parent)}
                            onChange={(e) => onUpdate(exercise.id, { is_warmup_parent: e.target.checked })}
                            disabled={!(exercise?.weight_kg != null || prescribedWeight != null)}
                          />
                          <span style={{ fontSize: 12, color: colors.text }}>Auto warm-up sets</span>
                        </label>
                        {Boolean(exercise?.is_warmup_parent) && (exercise?.weight_kg != null || prescribedWeight != null) ? (
                          <p style={{ margin: 0, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                            Warm-up sets (auto-generated at session start): W1 {(Number(exercise?.weight_kg ?? prescribedWeight) * 0.5).toFixed(1)}kg x 8, W2 {(Number(exercise?.weight_kg ?? prescribedWeight) * 0.75).toFixed(1)}kg x 5, W3 {(Number(exercise?.weight_kg ?? prescribedWeight) * 0.9).toFixed(1)}kg x 2.
                          </p>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {(setsInvalid || repsInvalid) && (
                  <p className="text-[11px]" style={{ color: colors.danger, margin: 0, opacity: 0.9 }}>
                    Use numbers ≥ 0
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

const ExerciseRow = memo(ExerciseRowInner);
export default ExerciseRow;
