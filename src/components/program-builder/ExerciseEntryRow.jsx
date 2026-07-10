import React from 'react';
import Card from '@/ui/Card';
import ExerciseEditor from '@/components/program-builder/ExerciseEditor';
import { colors, spacing } from '@/ui/tokens';

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
      />
    </>
  );
}
