import React from 'react';
import { colors, spacing, shell, touchTargetMin } from '@/ui/tokens';
import {
  ATLAS_MOVEMENT_PATTERNS,
  ATLAS_MUSCLES,
  ATLAS_EQUIPMENT_PRIMARY,
  MOVEMENT_LABELS,
  MUSCLE_LABELS,
  EQUIPMENT_PRIMARY_LABELS,
} from '@/lib/exerciseTaxonomy';
import ExerciseEntryRow from '@/components/program-builder/ExerciseEntryRow';

export default function ProgramDayColumn({
  selectedDay,
  personalBasicExperience,
  sectionLabel,
  libraryFilterMovement,
  setLibraryFilterMovement,
  libraryFilterMuscle,
  setLibraryFilterMuscle,
  libraryFilterEquipment,
  setLibraryFilterEquipment,
  liveProgramContext,
  exerciseEntryProps,
}) {
  if (!selectedDay) return null;

  return (
    <>
      {!personalBasicExperience ? (
        <div style={{ marginBottom: spacing[12] }}>
          <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Library filters</p>
          <div className="flex flex-wrap gap-2" style={{ alignItems: 'center' }}>
            <select
              value={libraryFilterMovement}
              onChange={(e) => setLibraryFilterMovement(e.target.value)}
              aria-label="Filter by movement pattern"
              style={{
                minHeight: touchTargetMin,
                borderRadius: shell.cardRadius,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface1,
                color: colors.text,
                padding: `${spacing[8]}px ${spacing[10]}px`,
                fontSize: 13,
              }}
            >
              <option value="">Any movement</option>
              {ATLAS_MOVEMENT_PATTERNS.map((k) => (
                <option key={k} value={k}>
                  {MOVEMENT_LABELS[k] || k}
                </option>
              ))}
            </select>
            <select
              value={libraryFilterMuscle}
              onChange={(e) => setLibraryFilterMuscle(e.target.value)}
              aria-label="Filter by muscle"
              style={{
                minHeight: touchTargetMin,
                borderRadius: shell.cardRadius,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface1,
                color: colors.text,
                padding: `${spacing[8]}px ${spacing[10]}px`,
                fontSize: 13,
              }}
            >
              <option value="">Any muscle</option>
              {ATLAS_MUSCLES.map((k) => (
                <option key={k} value={k}>
                  {MUSCLE_LABELS[k] || k}
                </option>
              ))}
            </select>
            <select
              value={libraryFilterEquipment}
              onChange={(e) => setLibraryFilterEquipment(e.target.value)}
              aria-label="Filter by equipment"
              style={{
                minHeight: touchTargetMin,
                borderRadius: shell.cardRadius,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface1,
                color: colors.text,
                padding: `${spacing[8]}px ${spacing[10]}px`,
                fontSize: 13,
              }}
            >
              <option value="">Any equipment</option>
              {ATLAS_EQUIPMENT_PRIMARY.map((k) => (
                <option key={k} value={k}>
                  {EQUIPMENT_PRIMARY_LABELS[k] || k}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <ExerciseEntryRow liveProgramContext={liveProgramContext} {...exerciseEntryProps} />
    </>
  );
}
