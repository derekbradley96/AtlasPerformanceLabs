/**
 * Exercise builder: sticky header, scrollable exercise cards, bottom add action (mobile-first).
 */
import React, { useCallback } from 'react';
import { Plus, Sparkles, History, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { colors, spacing, shell } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import ExerciseRow from './ExerciseRow';

const EDITOR_MAX_H = 'min(75vh, 720px)';

export default function ExerciseEditor({
  exercises,
  onAddExercise,
  onAddExerciseFromRecent,
  onUpdateExercise,
  onRemoveExercise,
  onMoveExercise,
  onDuplicateExercise,
  onCopyPreviousValues,
  onOpenPicker,
  recentExerciseNames = [],
  suggestionByExerciseId = {},
  notesPlaceholder = 'Notes (optional)',
  saving,
  emptyStateFooter = null,
  personalEditorMode = 'default',
  dayPromptActions = [],
  onSmartSwapExercise,
}) {
  const isEmpty = !exercises || exercises.length === 0;
  const count = exercises?.length ?? 0;
  const isPersonalBasic = personalEditorMode === 'personal_basic';
  const isPersonalEnhanced = personalEditorMode === 'personal_enhanced';

  const handleAdd = useCallback(() => {
    if (typeof onOpenPicker === 'function') {
      onOpenPicker();
      return;
    }
    onAddExercise?.();
  }, [onAddExercise, onOpenPicker]);

  return (
    <div
      style={{
        marginTop: spacing[8],
        display: 'flex',
        flexDirection: 'column',
        maxHeight: isEmpty ? 'none' : EDITOR_MAX_H,
        borderRadius: shell.cardRadius,
        border: isEmpty ? 'none' : `1px solid ${colors.border}`,
        background: isEmpty ? 'transparent' : colors.surface1,
        overflow: isEmpty ? 'visible' : 'hidden',
      }}
    >
      {/* Sticky-style header (within editor column) */}
      <div
        style={{
          flexShrink: 0,
          padding: `${spacing[12]}px ${spacing[14]}px ${spacing[8]}px`,
          borderBottom: isEmpty ? 'none' : `1px solid ${colors.border}`,
          background: colors.bg,
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p style={{ ...sectionLabel, marginBottom: 2 }}>Exercises</p>
            {!isEmpty ? (
              <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 600 }}>
                {count} {count === 1 ? 'lift' : 'lifts'}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {recentExerciseNames.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          style={{
            flexShrink: 0,
            padding: `${0}px ${spacing[14]}px ${spacing[8]}px`,
            background: colors.bg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          {recentExerciseNames.slice(0, 6).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onAddExerciseFromRecent?.(name)}
              disabled={saving}
              className="text-xs font-medium rounded-lg"
              style={{
                minHeight: 34,
                padding: `${spacing[6]}px ${spacing[10]}px`,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.text,
                opacity: saving ? 0.6 : 1,
              }}
            >
              + {name}
            </button>
          ))}
        </div>
      )}

      {isPersonalEnhanced && dayPromptActions.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          style={{
            flexShrink: 0,
            padding: `${spacing[6]}px ${spacing[14]}px ${spacing[10]}px`,
            background: colors.bg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          {dayPromptActions.slice(0, 4).map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg"
              style={{
                minHeight: 34,
                padding: `${spacing[6]}px ${spacing[10]}px`,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.text,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Sparkles size={12} /> {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable cards */}
      <div
        style={{
          flex: isEmpty ? '0 0 auto' : '1 1 auto',
          minHeight: 0,
          overflowY: isEmpty ? 'visible' : 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: isEmpty ? 0 : `${spacing[8]}px ${spacing[12]}px`,
        }}
      >
        {isEmpty ? (
          <>
            <EmptyState
              title="No exercises yet"
              description="Add the first exercise for this day."
              icon={Plus}
              actionLabel="Add first exercise"
              onAction={handleAdd}
            />
            <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[10] }}>
              {recentExerciseNames.length > 0 && (
                <button
                  type="button"
                  onClick={() => onAddExerciseFromRecent?.(recentExerciseNames[0])}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg"
                  style={{ minHeight: 34, padding: `${spacing[6]}px ${spacing[10]}px`, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, opacity: saving ? 0.6 : 1 }}
                >
                  <History size={12} /> Add from recent
                </button>
              )}
              {!isPersonalBasic && (
                <button
                  type="button"
                  onClick={() => (typeof onOpenPicker === 'function' ? onOpenPicker() : onAddExerciseFromRecent?.((recentExerciseNames[0] || 'Dumbbell Row')))}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg"
                  style={{ minHeight: 34, padding: `${spacing[6]}px ${spacing[10]}px`, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, opacity: saving ? 0.6 : 1 }}
                >
                  <Search size={12} /> Search exercise library
                </button>
              )}
            </div>
            {emptyStateFooter ? <div style={{ marginTop: spacing[12] }}>{emptyStateFooter}</div> : null}
          </>
        ) : (
          <div className="flex flex-col gap-3">
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
                onCopyPrevious={onCopyPreviousValues}
                hasPrevious={index > 0}
                suggestions={suggestionByExerciseId?.[exercise.id] || recentExerciseNames}
                notesPlaceholder={notesPlaceholder}
                saving={saving}
                personalEditorMode={personalEditorMode}
                onSmartSwap={onSmartSwapExercise}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom add action */}
      {!isEmpty && (
        <div
          style={{
            flexShrink: 0,
            padding: `${spacing[10]}px ${spacing[12]}px calc(${spacing[12]}px + env(safe-area-inset-bottom, 0px))`,
            borderTop: `1px solid ${colors.border}`,
            background: colors.bg,
          }}
        >
          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl transition-opacity"
            style={{
              minHeight: 48,
              padding: `${spacing[12]}px ${spacing[16]}px`,
              border: `1px solid ${colors.primary}`,
              background: colors.primary,
              color: '#fff',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.65 : 1,
              boxShadow: `0 4px 20px rgba(0,0,0,0.12)`,
            }}
          >
            <Plus size={18} strokeWidth={2.5} /> Add exercise
          </motion.button>
        </div>
      )}
    </div>
  );
}
