import React from 'react';
import WeekTabs from '@/components/program-builder/WeekTabs';
import DayTabs from '@/components/program-builder/DayTabs';
import ProgramDayColumn from '@/components/program-builder/ProgramDayColumn';
import EmptyState from '@/components/ui/EmptyState';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

export default function ProgramWeekView(props) {
  const {
    block,
    isPersonalRole,
    selectedWeek,
    totalWeeks,
    selectedWeekIndex,
    handleSelectWeek,
    handleCopyWeekToEnd,
    saving,
    personalBasicExperience,
    sectionLabel,
    sectionGap,
    sourceBlockId,
    setSourceBlockId,
    sourceBlocks,
    handleCopyFromSourceBlock,
    handleCopyPreviousWeek,
    handleQuickStartGenerate,
    personalEnhancedExperience,
    days,
    handleAddDay,
    personalEmptyWeekDescription,
    selectedDayIndex,
    setSelectedDayIndex,
    handleDuplicateDay,
    selectedDay,
    libraryFilterMovement,
    setLibraryFilterMovement,
    libraryFilterMuscle,
    setLibraryFilterMuscle,
    libraryFilterEquipment,
    setLibraryFilterEquipment,
    liveProgramContext,
    exerciseEntryProps,
    handleSaveBlock,
    headerEffectiveWeeksRef,
    openExercisePicker,
    isCoachRole,
    clientId,
    setGeneratedReveal,
  } = props;

  if (!block?.id) return null;

  return (
    <>
      {isPersonalRole && selectedWeek ? (
        <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, color: colors.muted }}>
          Week {selectedWeek.week_number || 1} of {Math.max(1, Number(totalWeeks) || 1)}
        </p>
      ) : null}
      {personalBasicExperience ? (
        <p style={{ ...sectionLabel, marginBottom: spacing[10] }}>Your week</p>
      ) : (
        <WeekTabs
          weeks={props.weeks}
          totalWeeks={totalWeeks}
          selectedWeekIndex={selectedWeekIndex}
          onSelectWeek={handleSelectWeek}
          onCopyWeek={handleCopyWeekToEnd}
          copyWeekDisabled={saving || !selectedWeek}
        />
      )}

      {selectedWeek && (!isPersonalRole || personalEnhancedExperience) ? (
        <Card style={{ ...props.standardCard, marginBottom: sectionGap, padding: spacing[12] }}>
          <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Builder toolbar</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyPreviousWeek}
              disabled={saving || Number(selectedWeek.week_number) <= 1}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.text,
                fontWeight: 600,
                opacity: saving || Number(selectedWeek.week_number) <= 1 ? 0.6 : 1,
              }}
            >
              Copy previous week
            </button>
            {!isPersonalRole ? (
              <div className="flex gap-2">
                <select
                  value={sourceBlockId}
                  onChange={(e) => setSourceBlockId(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: touchTargetMin,
                    borderRadius: radii.button,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                    padding: `0 ${spacing[10]}px`,
                  }}
                >
                  <option value="">Copy from this client block…</option>
                  {sourceBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title || 'Untitled block'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCopyFromSourceBlock}
                  disabled={saving || !sourceBlockId}
                  style={{
                    minHeight: touchTargetMin,
                    borderRadius: radii.button,
                    border: `1px solid ${colors.primary}`,
                    background: 'transparent',
                    color: colors.primary,
                    fontWeight: 700,
                    opacity: saving || !sourceBlockId ? 0.6 : 1,
                    padding: `0 ${spacing[12]}px`,
                  }}
                >
                  Copy
                </button>
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:col-span-2" style={{ gap: spacing[10] }}>
              <p style={{ flex: 1, margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                Uses your <strong style={{ color: colors.text, fontWeight: 600 }}>Quick start</strong> choices above (goal, days, structure).
              </p>
              <button
                type="button"
                onClick={() => {
                  setGeneratedReveal(null);
                  handleQuickStartGenerate();
                }}
                disabled={saving || !selectedWeek}
                style={{
                  flexShrink: 0,
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.primary}`,
                  background: colors.primary,
                  color: '#fff',
                  fontWeight: 700,
                  opacity: saving || !selectedWeek ? 0.6 : 1,
                  padding: `0 ${spacing[16]}px`,
                  cursor: saving || !selectedWeek ? 'not-allowed' : 'pointer',
                }}
              >
                {personalEnhancedExperience ? 'Generate smart draft' : 'Build my week'}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {selectedWeek && (
        <>
          {days.length === 0 ? (
            <div style={{ marginBottom: sectionGap }}>
              <EmptyState
                title="This week has no training days"
                description={personalEmptyWeekDescription(!!personalBasicExperience)}
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
                hideDuplicate={personalBasicExperience}
              />
              <ProgramDayColumn
                selectedDay={selectedDay}
                personalBasicExperience={personalBasicExperience}
                sectionLabel={sectionLabel}
                libraryFilterMovement={libraryFilterMovement}
                setLibraryFilterMovement={setLibraryFilterMovement}
                libraryFilterMuscle={libraryFilterMuscle}
                setLibraryFilterMuscle={setLibraryFilterMuscle}
                libraryFilterEquipment={libraryFilterEquipment}
                setLibraryFilterEquipment={setLibraryFilterEquipment}
                liveProgramContext={liveProgramContext}
                exerciseEntryProps={exerciseEntryProps}
              />
            </>
          )}
        </>
      )}

      {selectedDay ? (
        <div
          className="sticky bottom-0"
          style={{
            marginTop: spacing[12],
            paddingTop: spacing[10],
            paddingBottom: `calc(${spacing[10]}px + env(safe-area-inset-bottom, 0px))`,
            background: colors.bg,
            borderTop: `1px solid ${colors.border}`,
            display: 'grid',
            gap: spacing[8],
          }}
        >
          <button
            type="button"
            onClick={() => handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current })}
            disabled={saving}
            style={{
              minHeight: touchTargetMin + 4,
              borderRadius: radii.button,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {isPersonalRole ? 'Save plan' : personalBasicExperience ? 'Save plan' : 'Save block'}
          </button>
          <div className={personalBasicExperience ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
            <Button type="button" variant="outline" onClick={openExercisePicker} disabled={saving}>
              Add exercise
            </Button>
            {!personalBasicExperience ? (
              <Button type="button" variant="outline" onClick={handleDuplicateDay} disabled={saving}>
                Duplicate day
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
