/**
 * Exercise builder: sticky header, scrollable exercise cards, bottom add action (mobile-first).
 */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Plus, Sparkles, History, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { colors, spacing, shell } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import ExerciseRow from './ExerciseRow';
import { EXERCISES as LIBRARY_EXERCISES } from '@/data/exercises/exerciseLibrary';

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
  previousPerformanceByExerciseId = {},
  notesPlaceholder = 'Notes (optional)',
  saving,
  emptyStateFooter = null,
  personalEditorMode = 'default',
  dayPromptActions = [],
  onSmartSwapExercise,
  showPrepEducationPicker = false,
  isAssignedProgramLive = false,
  personalExperienceLevel = 'intermediate',
  onLinkSuperset,
  onRemoveSuperset,
}) {
  const supersetOptionsByExerciseId = useMemo(() => {
    const out = {};
    for (const ex of exercises || []) {
      out[ex.id] = (exercises || [])
        .filter((other) => other.id !== ex.id)
        .map((other) => ({ id: other.id, label: other.exercise_name || 'Exercise' }));
    }
    return out;
  }, [exercises]);

  const isEmpty = !exercises || exercises.length === 0;
  const count = exercises?.length ?? 0;
  const isPersonalBasic = personalEditorMode === 'personal_basic';
  const isPersonalEnhanced = personalEditorMode === 'personal_enhanced';

  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [inlineMuscleFilter, setInlineMuscleFilter] = useState('All');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(inlineSearchQuery), 2000);
    return () => window.clearTimeout(t);
  }, [inlineSearchQuery]);

  const muscleChips = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
  const quickAddMuscles = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
  const [quickAddMuscle, setQuickAddMuscle] = useState('');
  const quickAddResults = useMemo(() => {
    if (!(isPersonalBasic || isPersonalEnhanced) || !quickAddMuscle) return [];
    const target = quickAddMuscle.toLowerCase();
    const filtered = LIBRARY_EXERCISES.filter((row) => {
      const primary = String(row.primaryMuscle || '').toLowerCase();
      if (target === 'arms') return ['biceps', 'triceps', 'forearms'].includes(primary);
      if (target === 'legs') return ['quads', 'hamstrings', 'glutes', 'calves'].includes(primary);
      return primary === target;
    });
    const ranked = [...filtered].sort((a, b) => {
      const aName = String(a.name || '');
      const bName = String(b.name || '');
      const aBody = /(bodyweight|band)/i.test(String(a.equipment || ''));
      const bBody = /(bodyweight|band)/i.test(String(b.equipment || ''));
      const aBar = /(barbell)/i.test(String(a.equipment || ''));
      const bBar = /(barbell)/i.test(String(b.equipment || ''));
      if (personalExperienceLevel === 'beginner') {
        if (aBody !== bBody) return aBody ? -1 : 1;
      }
      if (personalExperienceLevel === 'advanced') {
        if (aBar !== bBar) return aBar ? -1 : 1;
      }
      return aName.localeCompare(bName);
    });
    return ranked.slice(0, 5);
  }, [isPersonalBasic, isPersonalEnhanced, quickAddMuscle, personalExperienceLevel]);
  const searchResults = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const rows = LIBRARY_EXERCISES.filter((row) => {
      if (inlineMuscleFilter === 'All') return true;
      if (inlineMuscleFilter === 'Arms') return ['Biceps', 'Triceps', 'Forearms'].includes(row.primaryMuscle);
      if (inlineMuscleFilter === 'Legs') return ['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(row.primaryMuscle);
      return String(row.primaryMuscle || '').toLowerCase() === inlineMuscleFilter.toLowerCase();
    });
    if (!q) return rows.slice(0, 8);
    const exact = [];
    const partial = [];
    const muscle = [];
    for (const row of rows) {
      const name = String(row.name || '').toLowerCase();
      const primaryMuscle = String(row.primaryMuscle || '').toLowerCase();
      if (name === q) exact.push(row);
      else if (name.includes(q)) partial.push(row);
      else if (primaryMuscle.includes(q)) muscle.push(row);
    }
    return [...exact, ...partial, ...muscle].slice(0, 8);
  }, [debouncedQuery, inlineMuscleFilter]);

  const handleAdd = useCallback(() => {
    setInlineSearchOpen((prev) => !prev);
  }, []);

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
      {inlineSearchOpen ? (
        <div style={{ padding: `${spacing[8]}px ${spacing[14]}px`, borderBottom: `1px solid ${colors.border}`, background: colors.bg }}>
          <input
            type="search"
            autoFocus
            value={inlineSearchQuery}
            onChange={(e) => setInlineSearchQuery(e.target.value)}
            placeholder="Search exercise library..."
            style={{ width: '100%', minHeight: 42, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 14, padding: '0 10px' }}
          />
          <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
            {muscleChips.map((chip) => (
              <button key={chip} type="button" onClick={() => setInlineMuscleFilter(chip)} style={{ border: `1px solid ${inlineMuscleFilter === chip ? colors.primary : colors.border}`, background: inlineMuscleFilter === chip ? colors.primarySubtle : colors.surface1, color: inlineMuscleFilter === chip ? colors.primary : colors.text, borderRadius: 999, fontSize: 12, fontWeight: 600, padding: '4px 10px' }}>
                {chip}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 6 }}>
            {searchResults.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onAddExercise?.({ exercise_name: row.name }, { silent: true });
                  setInlineSearchOpen(false);
                  setInlineSearchQuery('');
                }}
                style={{ textAlign: 'left', border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.surface1, color: colors.text, padding: '8px 10px' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.name}</div>
                <div style={{ fontSize: 11, color: colors.muted }}>{row.primaryMuscle} · {(row.equipment || []).join(', ') || 'Equipment varies'}</div>
              </button>
            ))}
            {/* Add exactly what was typed when it isn't in the library — day
                exercises are free-text names, so no library row is needed. */}
            {debouncedQuery.trim()
              && !searchResults.some((row) => String(row.name || '').toLowerCase() === debouncedQuery.trim().toLowerCase()) ? (
              <button
                type="button"
                onClick={() => {
                  onAddExercise?.({ exercise_name: debouncedQuery.trim() }, { silent: true });
                  setInlineSearchOpen(false);
                  setInlineSearchQuery('');
                }}
                style={{ textAlign: 'left', border: `1px dashed ${colors.primary}`, borderRadius: 10, background: colors.primarySubtle, color: colors.primary, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Add &ldquo;{debouncedQuery.trim()}&rdquo; as a custom exercise</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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
                previousPerformance={previousPerformanceByExerciseId?.[exercise.id] || null}
                notesPlaceholder={notesPlaceholder}
                saving={saving}
                personalEditorMode={personalEditorMode}
                personalExperienceLevel={personalExperienceLevel}
                onSmartSwap={onSmartSwapExercise}
                showPrepEducationPicker={showPrepEducationPicker}
                isAssignedProgramLive={isAssignedProgramLive}
                supersetOptions={supersetOptionsByExerciseId?.[exercise.id] || []}
                onLinkSuperset={onLinkSuperset}
                onRemoveSuperset={onRemoveSuperset}
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
          {(isPersonalBasic || isPersonalEnhanced) ? (
            <div style={{ marginBottom: spacing[10], display: 'grid', gap: spacing[8] }}>
              <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Quick add
              </p>
              <div className="flex flex-wrap gap-2">
                {quickAddMuscles.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setQuickAddMuscle((prev) => (prev === chip ? '' : chip))}
                    style={{
                      minHeight: 36,
                      padding: `0 ${spacing[10]}px`,
                      borderRadius: 999,
                      border: `1px solid ${quickAddMuscle === chip ? colors.primary : colors.border}`,
                      background: quickAddMuscle === chip ? colors.primarySubtle : colors.surface1,
                      color: quickAddMuscle === chip ? colors.primary : colors.text,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              {quickAddMuscle && quickAddResults.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {quickAddResults.map((row) => (
                    <button
                      key={`quick-${row.id}`}
                      type="button"
                      onClick={() => onAddExercise?.({ exercise_name: row.name }, { silent: true })}
                      disabled={saving}
                      style={{
                        minHeight: 36,
                        padding: `0 ${spacing[10]}px`,
                        borderRadius: 10,
                        border: `1px solid ${colors.border}`,
                        background: colors.surface1,
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {row.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
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
