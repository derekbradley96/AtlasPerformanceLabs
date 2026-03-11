/**
 * Exercise builder: section header, add exercise, list of ExerciseRow or empty state.
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import ExerciseRow from './ExerciseRow';

export default function ExerciseEditor({
  exercises,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onMoveExercise,
  onDuplicateExercise,
  notesPlaceholder = 'Notes (optional)',
  saving,
}) {
  const isEmpty = !exercises || exercises.length === 0;

  return (
    <div style={{ marginTop: spacing[8] }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: spacing[12] }}>
        <p style={{ ...sectionLabel, marginBottom: 0 }}>Exercises</p>
        <button
          type="button"
          onClick={onAddExercise}
          disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-opacity"
          style={{
            padding: `${spacing[8]}px ${spacing[12]}px`,
            border: `1px solid ${colors.primary}`,
            background: 'transparent',
            color: colors.primary,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Plus size={16} /> Add exercise
        </button>
      </div>

      {isEmpty ? (
        <EmptyState
          title="No exercises yet"
          description="Add the first exercise for this day."
          icon={Plus}
          actionLabel="Add first exercise"
          onAction={onAddExercise}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {exercises.map((exercise, index) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              index={index}
              totalCount={exercises.length}
              onUpdate={onUpdateExercise}
              onRemove={onRemoveExercise}
              onMoveUp={(idx) => onMoveExercise(idx, -1)}
              onMoveDown={(idx) => onMoveExercise(idx, 1)}
              onDuplicate={onDuplicateExercise}
              notesPlaceholder={notesPlaceholder}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}
