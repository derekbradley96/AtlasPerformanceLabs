/**
 * Single exercise card: name, sets, reps, rest, expandable advanced fields. Premium motion + haptics.
 */
import React, { useState, memo, useRef } from 'react';
import { ChevronUp, ChevronDown, Trash2, Copy, SlidersHorizontal, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { impactLight, selectionChanged } from '@/lib/haptics';

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

function StepperField({ value, placeholder, onChange, min = 0, ariaLabel, invalid = false }) {
  const dupGuard = useRef({ raw: null, open: false });
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
        value={value ?? ''}
        onFocus={(e) => e.target.select()}
        onChange={(e) => applyRaw(e.target.value)}
        onInput={(e) => applyRaw(e.currentTarget.value)}
        style={{ ...getInputStyle(invalid ? colors.danger : shell.cardBorder), width: '100%', textAlign: 'center', padding: `${spacing[8]}px ${spacing[8]}px` }}
        aria-label={ariaLabel}
        aria-invalid={invalid}
      />
      <button
        type="button"
        onClick={() => {
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
  notesPlaceholder = 'Notes (optional)',
  saving,
  personalEditorMode = 'default',
  onSmartSwap,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isPersonalBasic = personalEditorMode === 'personal_basic';
  const isPersonalEnhanced = personalEditorMode === 'personal_enhanced';
  const canMoveUp = index > 0 && !saving;
  const canMoveDown = index < totalCount - 1 && !saving;
  const nameEmpty = !String(exercise.exercise_name || '').trim();
  const setsNum = exercise.sets != null && exercise.sets !== '' ? Number(exercise.sets) : null;
  const repsNum = exercise.reps != null && exercise.reps !== '' ? Number(exercise.reps) : null;
  const setsInvalid = setsNum !== null && (isNaN(setsNum) || setsNum < 0);
  const repsInvalid = repsNum !== null && (isNaN(repsNum) || repsNum < 0);

  const toggleAdvanced = () => {
    impactLight();
    setShowAdvanced((v) => !v);
  };

  return (
    <motion.div
      data-exercise-row-id={exercise?.id || ''}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <Card style={{ ...standardCard, padding: spacing[14], border: `1px solid ${colors.border}` }}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-0.5 shrink-0" style={{ paddingTop: 2 }}>
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
              className="rounded p-1.5"
              style={{
                color: colors.muted,
                cursor: canMoveUp ? 'pointer' : 'not-allowed',
                background: 'none',
                border: 'none',
                opacity: canMoveUp ? 1 : 0.4,
              }}
            >
              <ChevronUp size={20} />
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
              className="rounded p-1.5"
              style={{
                color: colors.muted,
                cursor: canMoveDown ? 'pointer' : 'not-allowed',
                background: 'none',
                border: 'none',
                opacity: canMoveDown ? 1 : 0.4,
              }}
            >
              <ChevronDown size={20} />
            </motion.button>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <input
              type="text"
              placeholder="Exercise name"
              value={exercise.exercise_name || ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onUpdate(exercise.id, { exercise_name: e.target.value })}
              list={`exercise-suggestions-${exercise.id}`}
              style={{ ...getInputStyle(nameEmpty ? colors.danger : shell.cardBorder), width: '100%' }}
              aria-label="Exercise name"
              aria-invalid={nameEmpty}
            />
            <datalist id={`exercise-suggestions-${exercise.id}`}>
              {(suggestions || []).slice(0, 12).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {nameEmpty && (
              <p className="text-[11px]" style={{ color: colors.danger, margin: 0, opacity: 0.9 }}>
                Name required
              </p>
            )}

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
                        <p style={fieldLabel}>Tempo</p>
                        <input
                          type="text"
                          placeholder="3-1-2-0"
                          value={exercise.tempo || ''}
                          onChange={(e) => onUpdate(exercise.id, { tempo: e.target.value || null })}
                          style={{ ...getInputStyle(), width: '100%', fontSize: 13, padding: `${spacing[8]}px ${spacing[8]}px` }}
                          aria-label="Tempo"
                        />
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

          <motion.button
            type="button"
            onClick={async () => {
              await impactLight();
              onRemove(exercise.id);
            }}
            disabled={saving}
            whileTap={{ scale: saving ? 1 : 0.92 }}
            aria-label="Remove exercise"
            className="rounded-lg p-2 shrink-0"
            style={{
              color: colors.muted,
              cursor: saving ? 'wait' : 'pointer',
              background: 'none',
              border: 'none',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Trash2 size={18} />
          </motion.button>
        </div>
      </Card>
    </motion.div>
  );
}

const ExerciseRow = memo(ExerciseRowInner);
export default ExerciseRow;
