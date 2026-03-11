/**
 * Single exercise row: name, sets, reps, load, notes (grouped), reorder, duplicate, remove.
 * Validation is subtle (border only + optional short hint). Premium card styling.
 */
import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Copy } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';

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

export default function ExerciseRow({
  exercise,
  index,
  totalCount,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  notesPlaceholder = 'Notes (optional)',
  saving,
}) {
  const canMoveUp = index > 0 && !saving;
  const canMoveDown = index < totalCount - 1 && !saving;
  const nameEmpty = !String(exercise.exercise_name || '').trim();
  const setsNum = exercise.sets != null && exercise.sets !== '' ? Number(exercise.sets) : null;
  const repsNum = exercise.reps != null && exercise.reps !== '' ? Number(exercise.reps) : null;
  const setsInvalid = setsNum !== null && (isNaN(setsNum) || setsNum < 0);
  const repsInvalid = repsNum !== null && (isNaN(repsNum) || repsNum < 0);

  const handleSetsChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onUpdate(exercise.id, { sets: null });
      return;
    }
    const n = parseInt(raw, 10);
    onUpdate(exercise.id, { sets: isNaN(n) ? null : n });
  };

  const handleRepsChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onUpdate(exercise.id, { reps: null });
      return;
    }
    const n = parseInt(raw, 10);
    onUpdate(exercise.id, { reps: isNaN(n) ? null : n });
  };

  return (
    <Card style={{ ...standardCard, padding: spacing[16] }}>
      <div className="flex items-start gap-4">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5 shrink-0" style={{ paddingTop: 2 }}>
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={!canMoveUp}
            aria-label="Move up"
            className="rounded p-1.5 transition-opacity"
            style={{
              color: colors.muted,
              cursor: canMoveUp ? 'pointer' : 'not-allowed',
              background: 'none',
              border: 'none',
              opacity: canMoveUp ? 1 : 0.4,
            }}
          >
            <ChevronUp size={20} />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={!canMoveDown}
            aria-label="Move down"
            className="rounded p-1.5 transition-opacity"
            style={{
              color: colors.muted,
              cursor: canMoveDown ? 'pointer' : 'not-allowed',
              background: 'none',
              border: 'none',
              opacity: canMoveDown ? 1 : 0.4,
            }}
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {/* Name + Sets/Reps/Load row */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Exercise name"
            value={exercise.exercise_name || ''}
            onChange={(e) => onUpdate(exercise.id, { exercise_name: e.target.value })}
            style={{ ...getInputStyle(nameEmpty ? colors.danger : shell.cardBorder), width: '100%' }}
            aria-label="Exercise name"
            aria-invalid={nameEmpty}
          />
          {nameEmpty && (
            <p className="text-[11px]" style={{ color: colors.danger, margin: 0, opacity: 0.9 }}>
              Name required
            </p>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <input
              type="number"
              placeholder="Sets"
              min={0}
              value={exercise.sets ?? ''}
              onChange={handleSetsChange}
              style={{ ...getInputStyle(setsInvalid ? colors.danger : shell.cardBorder), width: '100%' }}
              aria-label="Sets"
              aria-invalid={setsInvalid}
            />
            <input
              type="number"
              placeholder="Reps"
              min={0}
              value={exercise.reps ?? ''}
              onChange={handleRepsChange}
              style={{ ...getInputStyle(repsInvalid ? colors.danger : shell.cardBorder), width: '100%' }}
              aria-label="Reps"
              aria-invalid={repsInvalid}
            />
            <input
              type="text"
              placeholder="Load %"
              value={exercise.percentage != null ? String(exercise.percentage) : ''}
              onChange={(e) =>
                onUpdate(exercise.id, {
                  percentage: e.target.value === '' ? null : parseFloat(e.target.value),
                })
              }
              style={{ ...getInputStyle(), width: '100%' }}
              aria-label="Load or percentage"
            />
          </div>
          {(setsInvalid || repsInvalid) && (
            <p className="text-[11px]" style={{ color: colors.danger, margin: 0, opacity: 0.9 }}>
              Use numbers ≥ 0
            </p>
          )}
          <input
            type="text"
            placeholder={notesPlaceholder}
            value={exercise.notes || ''}
            onChange={(e) => onUpdate(exercise.id, { notes: e.target.value || null })}
            style={{ ...getInputStyle(), width: '100%', fontSize: 13 }}

            aria-label="Notes"
          />
        </div>

        {/* Duplicate + Remove */}
        <div className="flex flex-col gap-2 shrink-0" style={{ paddingTop: 2 }}>
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(exercise, index)}
              disabled={saving}
              aria-label="Duplicate exercise"
              className="inline-flex items-center gap-1.5 rounded-lg transition-opacity"
              style={{
                padding: `${spacing[8]}px ${spacing[10]}px`,
                border: `1px solid ${shell.cardBorder}`,
                background: 'transparent',
                color: colors.text,
                fontSize: 12,
                fontWeight: 500,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Copy size={14} /> Duplicate
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(exercise.id)}
            disabled={saving}
            aria-label="Remove exercise"
            className="rounded-lg p-2 transition-opacity"
            style={{
              color: colors.muted,
              cursor: saving ? 'wait' : 'pointer',
              background: 'none',
              border: 'none',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </Card>
  );
}
