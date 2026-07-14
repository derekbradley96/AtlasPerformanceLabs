import React from 'react';
import WeekTabs from '@/components/program-builder/WeekTabs';
import DayTabs from '@/components/program-builder/DayTabs';
import ProgramDayColumn from '@/components/program-builder/ProgramDayColumn';
import BuilderActionMenu from '@/components/program-builder/BuilderActionMenu';
import EmptyState from '@/components/ui/EmptyState';
import { Calendar, Copy, CopyPlus, ArrowDownToLine, Library } from 'lucide-react';
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
  } = props;

  if (!block?.id) return null;

  // Week tools — hidden for Personal Basic (single-week focus, no copy tools).
  const weekMenuItems = personalBasicExperience
    ? []
    : [
        {
          key: 'copy-prev',
          label: 'Copy previous week',
          icon: ArrowDownToLine,
          onClick: handleCopyPreviousWeek,
          disabled: saving || Number(selectedWeek?.week_number) <= 1,
        },
        {
          key: 'copy-end',
          label: 'Copy this week to end',
          icon: CopyPlus,
          onClick: handleCopyWeekToEnd,
          disabled: saving || !selectedWeek,
        },
      ];

  // Day tools — "Browse library" (modal picker) for everyone; Duplicate day for
  // enhanced/coach. The quick inline add lives inside the exercise editor.
  const dayMenuItems = [
    {
      key: 'browse-library',
      label: 'Browse exercise library',
      icon: Library,
      onClick: openExercisePicker,
      disabled: saving,
    },
    {
      key: 'duplicate-day',
      label: 'Duplicate day',
      icon: Copy,
      onClick: handleDuplicateDay,
      disabled: saving,
      hidden: personalBasicExperience,
    },
  ];

  return (
    <>
      {/* Week selector */}
      {personalBasicExperience ? (
        <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Your week</p>
      ) : (
        <div className="flex items-start gap-2" style={{ marginBottom: spacing[10] }}>
          <WeekTabs
            weeks={props.weeks}
            totalWeeks={totalWeeks}
            selectedWeekIndex={selectedWeekIndex}
            onSelectWeek={handleSelectWeek}
          />
          {selectedWeek ? (
            <BuilderActionMenu ariaLabel="Week actions" items={weekMenuItems} disabled={saving} />
          ) : null}
        </div>
      )}

      {isPersonalRole && selectedWeek ? (
        <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 12, color: colors.muted }}>
          Week {selectedWeek.week_number || 1} of {Math.max(1, Number(totalWeeks) || 1)}
        </p>
      ) : null}

      {/* Coach: copy from another client block (quiet inline control) */}
      {!isPersonalRole && selectedWeek ? (
        <div className="flex gap-2" style={{ marginBottom: sectionGap }}>
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
              fontSize: 13,
            }}
          >
            <option value="">Copy from another client block…</option>
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
              opacity: saving || !sourceBlockId ? 0.5 : 1,
              padding: `0 ${spacing[14]}px`,
            }}
          >
            Copy
          </button>
        </div>
      ) : null}

      {/* Days + exercises */}
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
              <div className="flex items-center gap-2" style={{ marginBottom: spacing[14] }}>
                <DayTabs
                  days={days}
                  selectedDayIndex={selectedDayIndex}
                  onSelectDay={setSelectedDayIndex}
                  onAddDay={handleAddDay}
                  addDayDisabled={saving}
                />
                {selectedDay ? (
                  <BuilderActionMenu ariaLabel="Day actions" items={dayMenuItems} disabled={saving} />
                ) : null}
              </div>
              <ProgramDayColumn
                selectedDay={selectedDay}
                personalBasicExperience={personalBasicExperience}
                isPersonalRole={isPersonalRole}
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

      {/* Single sticky primary action — always reachable while editing a block */}
      {selectedWeek ? (
        <div
          className="sticky bottom-0"
          style={{
            marginTop: spacing[12],
            paddingTop: spacing[10],
            paddingBottom: `calc(${spacing[10]}px + env(safe-area-inset-bottom, 0px))`,
            background: colors.bg,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current })}
            disabled={saving}
            style={{
              width: '100%',
              minHeight: touchTargetMin + 4,
              borderRadius: radii.button,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : isPersonalRole || personalBasicExperience ? 'Save plan' : 'Save block'}
          </button>
        </div>
      ) : null}
    </>
  );
}
