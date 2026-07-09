import React from 'react';
import { Dumbbell, Target, TrendingUp, Zap } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

const GOAL_OPTIONS = [
  { value: 'muscle', label: 'Build Muscle', icon: Dumbbell },
  { value: 'fat_loss', label: 'Lose Fat', icon: Target },
  { value: 'strength', label: 'Strength', icon: TrendingUp },
  { value: 'competition', label: 'Comp Prep', icon: Zap },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const DURATION_PRESETS = [
  { value: '4', label: '4 weeks' },
  { value: '8', label: '8 weeks' },
  { value: '12', label: '12 weeks' },
  { value: 'custom', label: 'Custom' },
];

const ENTRY_TARGET_TEMPLATE = '__template__';

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: colors.muted,
  margin: `0 0 ${spacing[8]}px`,
};

function chipStyle(active) {
  return {
    minHeight: 36,
    padding: `0 ${spacing[14]}px`,
    background: active ? colors.primarySubtle : colors.surface1,
    color: active ? colors.primary : colors.text,
    border: `1px solid ${active ? colors.primary : colors.border}`,
    borderRadius: radii.pill,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };
}

export default function ProgramEntryPanel({
  isPersonalRole,
  clients,
  saving,
  blockName,
  setBlockName,
  entryGoal,
  setEntryGoal,
  entryDaysPerWeek,
  setEntryDaysPerWeek,
  entryWeeksPreset,
  setEntryWeeksPreset,
  entryCustomWeeks,
  setEntryCustomWeeks,
  entryWhoFor,
  onEntryWhoForChange,
  onGenerate,
  onStartBlank,
}) {
  const isTemplate = entryWhoFor === ENTRY_TARGET_TEMPLATE;

  const canGenerate = isPersonalRole
    ? !!blockName.trim()
    : !!blockName.trim() && !!entryWhoFor;

  const canStartBlank = isPersonalRole
    ? !!blockName.trim()
    : !!blockName.trim() && !!entryWhoFor && !isTemplate;

  return (
    <Card style={{ marginBottom: spacing[24], padding: spacing[20] }}>
      <h2 style={{ color: colors.text, fontWeight: 700, fontSize: 17, margin: `0 0 ${spacing[20]}px` }}>
        {isPersonalRole ? 'New training plan' : 'New program block'}
      </h2>

      {/* Coach: who is this for? */}
      {!isPersonalRole && (
        <div style={{ marginBottom: spacing[16] }}>
          <p style={labelStyle}>For</p>
          <select
            value={entryWhoFor}
            onChange={(e) => onEntryWhoForChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: touchTargetMin,
              padding: `0 ${spacing[14]}px`,
              borderRadius: radii.button,
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              color: entryWhoFor ? colors.text : colors.muted,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          >
            <option value="">Select client…</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={ENTRY_TARGET_TEMPLATE}>Template (no client)</option>
          </select>
        </div>
      )}

      {/* Name */}
      <div style={{ marginBottom: spacing[16] }}>
        <p style={labelStyle}>{isPersonalRole ? 'Plan name' : 'Block name'}</p>
        <input
          type="text"
          placeholder={isPersonalRole ? 'e.g. Spring strength plan' : 'e.g. Hypertrophy Block A'}
          value={blockName}
          onChange={(e) => setBlockName(e.target.value)}
          style={{
            width: '100%',
            minHeight: touchTargetMin,
            padding: `${spacing[12]}px ${spacing[14]}px`,
            borderRadius: radii.button,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            fontSize: 15,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Goal */}
      <div style={{ marginBottom: spacing[16] }}>
        <p style={labelStyle}>Goal</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setEntryGoal(value)}
              style={chipStyle(entryGoal === value)}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Days per week */}
      <div style={{ marginBottom: spacing[16] }}>
        <p style={labelStyle}>Days per week</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {DAYS_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEntryDaysPerWeek(n)}
              style={{ ...chipStyle(entryDaysPerWeek === n), minWidth: 44, padding: 0, justifyContent: 'center' }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div style={{ marginBottom: spacing[20] }}>
        <p style={labelStyle}>Duration</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DURATION_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setEntryWeeksPreset(value)}
              style={chipStyle(entryWeeksPreset === value)}
            >
              {label}
            </button>
          ))}
        </div>
        {entryWeeksPreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: spacing[8] }}>
            <input
              type="number"
              min={1}
              max={52}
              value={entryCustomWeeks}
              onChange={(e) => setEntryCustomWeeks(e.target.value)}
              style={{
                width: 72,
                minHeight: 36,
                padding: `0 ${spacing[10]}px`,
                borderRadius: radii.button,
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: 14,
                textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 13, color: colors.muted }}>weeks</span>
          </div>
        )}
      </div>

      {/* Personal builds manually — no auto-generated plan. Coaches keep the
          generator plus the blank option. */}
      {isPersonalRole ? (
        <button
          type="button"
          onClick={onStartBlank}
          disabled={saving || !canStartBlank}
          style={{
            width: '100%',
            minHeight: 50,
            borderRadius: radii.button,
            background: canStartBlank && !saving ? colors.primary : colors.surface2,
            color: canStartBlank && !saving ? '#fff' : colors.muted,
            border: 'none',
            fontSize: 15,
            fontWeight: 700,
            cursor: saving || !canStartBlank ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Creating…' : 'Create my plan'}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onGenerate}
            disabled={saving || !canGenerate}
            style={{
              width: '100%',
              minHeight: 50,
              borderRadius: radii.button,
              background: canGenerate && !saving ? colors.primary : colors.surface2,
              color: canGenerate && !saving ? '#fff' : colors.muted,
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: saving || !canGenerate ? 'not-allowed' : 'pointer',
              marginBottom: spacing[10],
              transition: 'background 0.15s, opacity 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Generating…' : 'Generate program'}
          </button>

          {canStartBlank && (
            <button
              type="button"
              onClick={onStartBlank}
              disabled={saving}
              style={{
                width: '100%',
                minHeight: 44,
                borderRadius: radii.button,
                background: 'transparent',
                color: colors.muted,
                border: `1px solid ${colors.border}`,
                fontSize: 13,
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Start blank
            </button>
          )}
        </>
      )}
    </Card>
  );
}
