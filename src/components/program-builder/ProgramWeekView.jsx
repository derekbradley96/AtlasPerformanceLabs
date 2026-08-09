import React, { useState } from 'react';
import WeekTabs from '@/components/program-builder/WeekTabs';
import DayTabs from '@/components/program-builder/DayTabs';
import ProgramDayColumn from '@/components/program-builder/ProgramDayColumn';
import BuilderActionMenu from '@/components/program-builder/BuilderActionMenu';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Calendar, Copy, CopyPlus, ArrowDownToLine, Library, Pencil, Trash2 } from 'lucide-react';
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
    handleRenameDay,
    handleDeleteDay,
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

  // Rename/delete state is view-local; persistence lives in the page handlers.
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (!block?.id) return null;

  const submitRename = () => {
    setRenameOpen(false);
    void handleRenameDay?.(renameValue);
  };

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
    {
      key: 'rename-day',
      label: 'Rename day',
      icon: Pencil,
      onClick: () => {
        setRenameValue(selectedDay?.title || `Day ${selectedDay?.day_number ?? ''}`.trim());
        setRenameOpen(true);
      },
      disabled: saving,
    },
    {
      key: 'delete-day',
      label: 'Delete day',
      icon: Trash2,
      onClick: () => setDeleteConfirmOpen(true),
      disabled: saving || days.length <= 1,
      danger: true,
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
              {renameOpen && selectedDay ? (
                <div className="flex items-center gap-2" style={{ marginBottom: spacing[12] }}>
                  <input
                    type="text"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename();
                      if (e.key === 'Escape') setRenameOpen(false);
                    }}
                    placeholder='e.g. "Upper A", "Push", "Legs"'
                    maxLength={40}
                    style={{ flex: 1, minWidth: 0, minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.primary}`, background: colors.surface1, color: colors.text, padding: `0 ${spacing[12]}px`, fontSize: 14 }}
                  />
                  <button
                    type="button"
                    onClick={submitRename}
                    style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, padding: `0 ${spacing[14]}px` }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenameOpen(false)}
                    style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.muted, fontWeight: 700, padding: `0 ${spacing[12]}px` }}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              <ConfirmDialog
                open={deleteConfirmOpen}
                title="Delete this day?"
                message={`"${selectedDay?.title || `Day ${selectedDay?.day_number ?? ''}`}" and its exercises will be removed from this week. Other weeks are not affected.`}
                confirmLabel="Delete day"
                cancelLabel="Keep it"
                onConfirm={() => {
                  setDeleteConfirmOpen(false);
                  void handleDeleteDay?.();
                }}
                onCancel={() => setDeleteConfirmOpen(false)}
              />
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
