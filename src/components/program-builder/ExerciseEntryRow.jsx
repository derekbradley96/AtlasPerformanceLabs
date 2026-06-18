import React from 'react';
import Card from '@/ui/Card';
import ExerciseEditor from '@/components/program-builder/ExerciseEditor';
import { Link } from 'react-router-dom';
import { colors, spacing } from '@/ui/tokens';
import { markPersonalUpgradePromptShown, PERSONAL_UPGRADE_PROMPT_TYPES } from '@/lib/personalPlanAccess';

export default function ExerciseEntryRow({
  liveProgramContext,
  standardCard,
  sectionGap,
  shell,
  exercises,
  handleAddExercise,
  openExercisePicker,
  handleUpdateExercise,
  handleRemoveExercise,
  handleMoveExercise,
  handleDuplicateExercise,
  handleCopyPreviousRowSetup,
  currentDayRecentNames,
  personalBasicExperience,
  suggestionByExerciseId,
  previousPerformanceByExerciseId,
  saving,
  personalEnhancedExperience,
  dayPromptActions,
  handleSmartSwapExercise,
  isPrepOriented,
  isCoachRole,
  clientId,
  block,
  personalExperienceLevel,
  handleLinkSuperset,
  handleRemoveSuperset,
  showPersonalBuilderEmptyHint,
  personalBuilderEmptyCopy,
}) {
  return (
    <>
      {liveProgramContext?.clientId ? (
        <Card
          style={{
            ...standardCard,
            marginBottom: spacing[10],
            padding: spacing[12],
            background: colors.primarySubtle,
            border: `1px solid ${colors.primary}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: 600 }}>
            This programme is live — {liveProgramContext.clientName} is currently using it. Changes save instantly.
          </p>
        </Card>
      ) : null}
      <ExerciseEditor
        exercises={exercises}
        onAddExercise={handleAddExercise}
        onAddExerciseFromRecent={(name) => handleAddExercise({ exercise_name: name })}
        onOpenPicker={openExercisePicker}
        onUpdateExercise={handleUpdateExercise}
        onRemoveExercise={handleRemoveExercise}
        onMoveExercise={handleMoveExercise}
        onDuplicateExercise={handleDuplicateExercise}
        onCopyPreviousValues={handleCopyPreviousRowSetup}
        recentExerciseNames={currentDayRecentNames}
        suggestionByExerciseId={personalBasicExperience ? {} : suggestionByExerciseId}
        previousPerformanceByExerciseId={previousPerformanceByExerciseId}
        notesPlaceholder={isPrepOriented ? 'Notes (optional)' : 'Notes (optional)'}
        saving={saving}
        personalEditorMode={
          personalBasicExperience ? 'personal_basic' : personalEnhancedExperience ? 'personal_enhanced' : 'default'
        }
        dayPromptActions={dayPromptActions}
        onSmartSwapExercise={personalEnhancedExperience ? handleSmartSwapExercise : undefined}
        showPrepEducationPicker={isPrepOriented && isCoachRole && Boolean(clientId || block?.client_id)}
        isAssignedProgramLive={Boolean(liveProgramContext?.clientId)}
        personalExperienceLevel={personalExperienceLevel}
        onLinkSuperset={handleLinkSuperset}
        onRemoveSuperset={handleRemoveSuperset}
        emptyStateFooter={
          showPersonalBuilderEmptyHint && exercises.length === 0 ? (
            <Card
              style={{
                padding: spacing[12],
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: colors.text }}>{personalBuilderEmptyCopy.title}</p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                {personalBuilderEmptyCopy.body}
              </p>
              <Link
                to="/pricing"
                onClick={() => markPersonalUpgradePromptShown(PERSONAL_UPGRADE_PROMPT_TYPES.BUILDER_EMPTY)}
                className="inline-block mt-2 text-[11px] font-semibold"
                style={{ color: colors.primary }}
              >
                See plans
              </Link>
            </Card>
          ) : null
        }
      />
    </>
  );
}
