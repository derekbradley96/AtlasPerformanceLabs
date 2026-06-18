import React from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';
import {
  ATLAS_MUSCLES,
  ATLAS_EQUIPMENT_PRIMARY,
  MUSCLE_LABELS,
  EQUIPMENT_PRIMARY_LABELS,
} from '@/lib/exerciseTaxonomy';

const QUICK_START_GOAL_OPTIONS = [
  { value: 'muscle', label: 'Build muscle' },
  { value: 'fat_loss', label: 'Lose fat' },
  { value: 'competition', label: 'Competition prep' },
];

const WEEK_STRUCTURE_OPTIONS = [
  { id: 'full_body', label: 'Full body', description: 'Whole body each session' },
  { id: 'upper_lower', label: 'Upper / lower', description: 'Alternate upper and lower days' },
  { id: 'push_pull_legs', label: 'Push / pull / legs', description: 'Classic PPL rhythm' },
  { id: 'body_part', label: 'Body part split', description: 'One main area per day' },
  { id: 'custom', label: 'Custom', description: 'Day 1, Day 2… — you name the flow' },
];

export default function AutoBuildSheet({
  mode = 'existing',
  block,
  personalBasicExperience,
  personalEnhancedExperience,
  sectionGap,
  isPersonalRole,
  canUsePersonalAutoBuilder,
  personalUpgradeCopy,
  autoBuildExplainability,
  quickGoal,
  setQuickGoal,
  quickDaysPerWeek,
  setQuickDaysPerWeek,
  setQuickDaysPerWeekInput,
  weekStructureType,
  setWeekStructureType,
  quickStartPreviewTitles,
  libraryFilterEquipment,
  setLibraryFilterEquipment,
  libraryFilterMuscle,
  setLibraryFilterMuscle,
  handleQuickStartGenerate,
  saving,
  selectedWeek,
  generatedReveal,
  setGeneratedReveal,
  revealDays,
  navigate,
  handleAddExercise,
  handleCopyPreviousWeek,
  showBuildSequence,
  BUILD_STEPS,
  buildStepIndex,
  entryConfig = null,
}) {
  if (mode === 'entry' && entryConfig) {
    const {
      showWhoForStep,
      whoForValue,
      whoForOptions,
      onWhoForChange,
      whoForLabel,
      goalOptions,
      selectedGoal,
      onGoalSelect,
      daysPerWeek,
      onDaysPerWeekSelect,
      weeksPreset,
      onWeeksPresetChange,
      customWeeksValue,
      onCustomWeeksChange,
      onGenerate,
      onStartFromScratch,
      onShowTemplates,
      templateCards,
      onTemplateSelect,
      templatesOpen,
      generateDisabled,
      generateDisabledHint,
    } = entryConfig;

    return (
      <>
        <Card style={{ marginBottom: sectionGap, padding: spacing[16] }}>
          <p style={{ marginBottom: spacing[6], fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Smart Program Builder
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>
            Build a full plan in seconds
          </p>
          <p style={{ margin: `${spacing[8]}px 0 ${spacing[16]}px`, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
            Answer a few quick questions and Atlas will generate the starting structure for you.
          </p>

          {showWhoForStep && (
            <div style={{ marginBottom: spacing[16] }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>
                {whoForLabel || 'Who is this for?'}
              </p>
              <select
                value={whoForValue}
                onChange={(e) => onWhoForChange(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: spacing[8],
                  minHeight: touchTargetMin,
                  borderRadius: shell.cardRadius,
                  border: `1px solid ${shell.cardBorder}`,
                  background: colors.surface1,
                  color: colors.text,
                  padding: `${spacing[8]}px ${spacing[10]}px`,
                  fontSize: 14,
                }}
              >
                {whoForOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: spacing[16] }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>What&apos;s the goal?</p>
            <div className="grid grid-cols-2 gap-2" style={{ marginTop: spacing[8] }}>
              {goalOptions.map((goal) => {
                const active = selectedGoal === goal.value;
                return (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => onGoalSelect(goal.value)}
                    style={{
                      minHeight: touchTargetMin + 2,
                      borderRadius: radii.button,
                      border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                      background: active ? colors.primarySubtle : colors.surface2,
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: `${spacing[8]}px ${spacing[10]}px`,
                    }}
                  >
                    {goal.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: spacing[16] }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>How many days per week?</p>
            <div className="grid grid-cols-6 gap-2" style={{ marginTop: spacing[8] }}>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const active = daysPerWeek === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onDaysPerWeekSelect(n)}
                    style={{
                      minHeight: touchTargetMin + 4,
                      borderRadius: radii.button,
                      border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                      background: active ? colors.primarySubtle : colors.surface2,
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: spacing[16] }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>How many weeks?</p>
            <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[8] }}>
              {['4', '8', '12', 'custom'].map((opt) => {
                const active = weeksPreset === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onWeeksPresetChange(opt)}
                    style={{
                      minHeight: touchTargetMin,
                      minWidth: 76,
                      borderRadius: radii.button,
                      border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                      background: active ? colors.primarySubtle : colors.surface2,
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: `0 ${spacing[12]}px`,
                    }}
                  >
                    {opt === 'custom' ? 'Custom' : opt}
                  </button>
                );
              })}
            </div>
            {weeksPreset === 'custom' && (
              <input
                type="number"
                min={1}
                max={52}
                value={customWeeksValue}
                onChange={(e) => onCustomWeeksChange(e.target.value)}
                placeholder="Enter weeks (1-52)"
                style={{
                  width: '100%',
                  marginTop: spacing[8],
                  minHeight: touchTargetMin,
                  borderRadius: shell.cardRadius,
                  border: `1px solid ${shell.cardBorder}`,
                  background: colors.surface1,
                  color: colors.text,
                  padding: `${spacing[8]}px ${spacing[10]}px`,
                  fontSize: 14,
                }}
              />
            )}
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={generateDisabled || saving}
            style={{
              width: '100%',
              minHeight: touchTargetMin + 6,
              borderRadius: radii.button,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: generateDisabled || saving ? 'not-allowed' : 'pointer',
              opacity: generateDisabled || saving ? 0.7 : 1,
            }}
          >
            Generate Program
          </button>
          <button
            type="button"
            onClick={onStartFromScratch}
            style={{
              marginTop: spacing[8],
              width: '100%',
              minHeight: touchTargetMin - 4,
              borderRadius: radii.button,
              border: 'none',
              background: 'transparent',
              color: colors.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start from scratch
          </button>
          <button
            type="button"
            onClick={onShowTemplates}
            style={{
              marginTop: spacing[4],
              width: '100%',
              minHeight: touchTargetMin - 4,
              borderRadius: radii.button,
              border: 'none',
              background: 'transparent',
              color: colors.primary,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Use a template
          </button>
          {generateDisabledHint ? (
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted, textAlign: 'center' }}>
              {generateDisabledHint}
            </p>
          ) : null}
          {templatesOpen && Array.isArray(templateCards) && templateCards.length > 0 ? (
            <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[10] }}>
              {templateCards.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onTemplateSelect(template.id)}
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    borderRadius: shell.cardRadius,
                    border: `1px solid ${shell.cardBorder}`,
                    background: colors.surface1,
                    color: colors.text,
                    padding: spacing[12],
                    cursor: 'pointer',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>{template.name}</p>
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>
                    {template.description}
                  </p>
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, color: colors.muted }}>
                    {template.days?.length || 0} training days
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        {showBuildSequence && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.58)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 60,
              padding: spacing[16],
            }}
          >
            <Card style={{ width: '100%', maxWidth: 420, padding: spacing[16], border: `1px solid ${colors.border}` }}>
              <div className="flex items-center gap-2">
                <Wand2 size={18} style={{ color: colors.primary }} />
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>Generating your program</p>
              </div>
              <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
                {BUILD_STEPS.map((step, idx) => (
                  <div key={step} className="flex items-center gap-2" style={{ opacity: idx <= buildStepIndex ? 1 : 0.55 }}>
                    {idx === buildStepIndex ? (
                      <Loader2 size={14} className="animate-spin" style={{ color: colors.primary }} />
                    ) : idx < buildStepIndex ? (
                      <span style={{ color: colors.success, fontSize: 14 }}>✓</span>
                    ) : (
                      <span style={{ color: colors.muted, fontSize: 14 }}>•</span>
                    )}
                    <span style={{ fontSize: 13, color: colors.text }}>{step}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {block?.id && (!personalBasicExperience || personalEnhancedExperience) && (
        <Card style={{ marginBottom: sectionGap, padding: spacing[16] }}>
          <p style={{ marginBottom: spacing[6], fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {personalEnhancedExperience ? 'Smart Builder' : 'Quick start'}
          </p>
          <p style={{ fontSize: 13, color: colors.muted, marginTop: 0, marginBottom: spacing[16], lineHeight: 1.45 }}>
            {personalEnhancedExperience
              ? 'Build your week faster. Atlas drafts a smart week, and you keep full control to edit everything.'
              : 'Build your first week. Atlas creates a clean starting point you can edit manually.'}
          </p>
          {isPersonalRole && !canUsePersonalAutoBuilder && !personalBasicExperience && (
            <div style={{ marginBottom: spacing[10], padding: spacing[12], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius, background: colors.surface1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>{personalUpgradeCopy.title}</p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
                {personalUpgradeCopy.body}
              </p>
            </div>
          )}
          {personalEnhancedExperience && autoBuildExplainability.length > 0 && (
            <ul className="space-y-1" style={{ margin: `0 0 ${spacing[16]}px`, paddingLeft: spacing[16] }}>
              {autoBuildExplainability.slice(0, 3).map((line, idx) => (
                <li key={`auto-explain-${idx}`} className="text-xs" style={{ color: colors.muted }}>
                  {line}
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginBottom: spacing[20] }}>
            <p style={{ marginBottom: spacing[10], fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goal</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: `0 0 ${spacing[10]}px` }}>
              What are you training for?
            </p>
            <div className="flex flex-wrap" style={{ gap: spacing[8] }}>
              {QUICK_START_GOAL_OPTIONS.map((opt) => {
                const active = quickGoal === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuickGoal(opt.value)}
                    style={{
                      minHeight: touchTargetMin - 2,
                      padding: `${spacing[10]}px ${spacing[16]}px`,
                      borderRadius: radii.button,
                      border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                      background: active ? colors.primarySubtle : colors.surface2,
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: spacing[20] }}>
            <p style={{ marginBottom: spacing[10], fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {personalEnhancedExperience ? 'Week structure + preferences' : 'Week structure'}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: `0 0 ${spacing[8]}px` }}>
              How many days per week?
            </p>
            <div className="flex flex-wrap" style={{ gap: spacing[8], marginBottom: spacing[16] }}>
              {[2, 3, 4, 5, 6].map((n) => {
                const active = quickDaysPerWeek === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setQuickDaysPerWeek(n);
                      setQuickDaysPerWeekInput(String(n));
                    }}
                    style={{
                      minWidth: 44,
                      minHeight: touchTargetMin - 2,
                      padding: spacing[8],
                      borderRadius: radii.button,
                      border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                      background: active ? colors.primarySubtle : colors.surface2,
                      color: colors.text,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: `0 0 ${spacing[10]}px` }}>
              How do you want to structure your week?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" style={{ marginBottom: spacing[14] }}>
              {WEEK_STRUCTURE_OPTIONS.map((opt) => {
                const active = weekStructureType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWeekStructureType(opt.id)}
                    style={{
                      textAlign: 'left',
                      minHeight: touchTargetMin + 12,
                      padding: spacing[14],
                      borderRadius: shell.cardRadius,
                      border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                      background: active ? colors.primarySubtle : colors.surface1,
                      color: colors.text,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{opt.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: colors.muted, marginTop: spacing[4], lineHeight: 1.35 }}>
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                padding: spacing[14],
                borderRadius: shell.cardRadius,
                border: `1px dashed ${shell.cardBorder}`,
                background: colors.surface2,
              }}
            >
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Preview
              </p>
              <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
                {quickStartPreviewTitles.join(' · ')}
              </p>
            </div>
            {personalEnhancedExperience && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ marginTop: spacing[12] }}>
                <label style={{ display: 'grid', gap: spacing[6] }}>
                  <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Equipment preference
                  </span>
                  <select
                    value={libraryFilterEquipment}
                    onChange={(e) => setLibraryFilterEquipment(e.target.value)}
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
                      <option key={k} value={k}>{EQUIPMENT_PRIMARY_LABELS[k] || k}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: spacing[6] }}>
                  <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Focus bias
                  </span>
                  <select
                    value={libraryFilterMuscle}
                    onChange={(e) => setLibraryFilterMuscle(e.target.value)}
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
                    <option value="">Balanced</option>
                    {ATLAS_MUSCLES.map((k) => (
                      <option key={k} value={k}>{MUSCLE_LABELS[k] || k}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleQuickStartGenerate()}
            disabled={saving || !selectedWeek}
            style={{
              width: '100%',
              marginTop: spacing[4],
              minHeight: touchTargetMin + 4,
              padding: `${spacing[14]}px ${spacing[16]}px`,
              borderRadius: radii.button,
              background: colors.primary,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: saving || !selectedWeek ? 'not-allowed' : 'pointer',
              opacity: saving || !selectedWeek ? 0.7 : 1,
            }}
          >
            {personalEnhancedExperience ? 'Generate smart draft' : 'Create week 1'}
          </button>
          {generatedReveal && (
            <div style={{ marginTop: spacing[12], border: `1px solid ${colors.border}`, borderRadius: radii.card, background: colors.surface2, padding: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Program ready
              </p>
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>
                {QUICK_START_GOAL_OPTIONS.find((o) => o.value === generatedReveal.goal)?.label || generatedReveal.goal}
                {' · '}
                {WEEK_STRUCTURE_OPTIONS.find((o) => o.id === generatedReveal.splitType)?.label
                  || String(generatedReveal.splitType || '').replaceAll('_', ' ')}
                {' · '}
                {generatedReveal.daysPerWeek} days
              </p>
              <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[8] }}>
                {revealDays.map((d, idx) => {
                  const ex = Array.isArray(d?.exercises) ? d.exercises : [];
                  const shown = ex.slice(0, 4);
                  return (
                    <div key={`reveal-day-${idx}`} style={{ padding: spacing[10], borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.surface1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>{d?.title || `Day ${idx + 1}`}</p>
                      <ul style={{ margin: `${spacing[6]}px 0 0`, paddingLeft: spacing[16] }}>
                        {shown.map((item, i) => (
                          <li key={`reveal-ex-${idx}-${i}`} style={{ fontSize: 12, color: colors.muted, lineHeight: 1.35 }}>
                            {item?.name || 'Exercise'}
                          </li>
                        ))}
                      </ul>
                      {ex.length > shown.length ? (
                        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.muted }}>
                          +{ex.length - shown.length} more
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: spacing[10], border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: spacing[10], background: colors.surface1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>Why this works</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                  The split matches your training days and goal. Exercise choices balance stimulus and fatigue so Day 1 feels clear and the week stays sustainable.
                </p>
              </div>
              {personalEnhancedExperience && (
                <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[10] }}>
                  <button
                    type="button"
                    onClick={() => handleAddExercise({ exercise_name: 'Incline Dumbbell Press', sets: 3, reps: '8-12', rest_seconds: 90 })}
                    style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px` }}
                  >
                    Add chest volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDaysPerWeek((n) => Math.max(2, Number(n || 3) - 1))}
                    style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px` }}
                  >
                    Simplify the week
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPreviousWeek}
                    disabled={!selectedWeek || Number(selectedWeek.week_number) <= 1}
                    style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px`, opacity: !selectedWeek || Number(selectedWeek.week_number) <= 1 ? 0.5 : 1 }}
                  >
                    Repeat last structure
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStartGenerate()}
                    style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px` }}
                  >
                    Adjust from recent training
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginTop: spacing[10] }}>
                <button
                  type="button"
                  onClick={() => navigate('/today')}
                  style={{
                    minHeight: touchTargetMin,
                    borderRadius: radii.button,
                    border: 'none',
                    background: colors.primary,
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  Start program
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedReveal(null)}
                  style={{
                    minHeight: touchTargetMin,
                    borderRadius: radii.button,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                    fontWeight: 600,
                  }}
                >
                  Adjust plan
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickStartGenerate()}
                  disabled={saving || !selectedWeek}
                  style={{
                    minHeight: touchTargetMin,
                    borderRadius: radii.button,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                    fontWeight: 600,
                    opacity: saving || !selectedWeek ? 0.7 : 1,
                  }}
                >
                  Rebuild
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {showBuildSequence && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: spacing[16],
          }}
        >
          <Card style={{ width: '100%', maxWidth: 420, padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <div className="flex items-center gap-2">
              <Wand2 size={18} style={{ color: colors.primary }} />
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>Building your program</p>
            </div>
            <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
              {BUILD_STEPS.map((step, idx) => (
                <div key={step} className="flex items-center gap-2" style={{ opacity: idx <= buildStepIndex ? 1 : 0.55 }}>
                  {idx === buildStepIndex ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: colors.primary }} />
                  ) : idx < buildStepIndex ? (
                    <span style={{ color: colors.success, fontSize: 14 }}>✓</span>
                  ) : (
                    <span style={{ color: colors.muted, fontSize: 14 }}>•</span>
                  )}
                  <span style={{ fontSize: 13, color: colors.text }}>{step}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
