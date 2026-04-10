import React from 'react';
import { colors, spacing, radii, shell } from '@/ui/tokens';

const labelStyle = {
  margin: `0 0 ${spacing[8]}px`,
  fontSize: 10,
  fontWeight: 700,
  color: colors.muted,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

function Pill({ selected, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: radii.pill,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${selected ? 'rgba(37, 99, 235, 0.55)' : colors.border}`,
        background: selected ? colors.primarySubtle : 'transparent',
        color: colors.text,
        cursor: 'pointer',
        transition: 'border-color 0.12s ease, background 0.12s ease',
      }}
    >
      {children}
    </button>
  );
}

function PillRow({ children }) {
  return (
    <div className="flex flex-wrap" style={{ gap: spacing[8] }}>
      {children}
    </div>
  );
}

/**
 * Compact marketplace filters: Goal, Pricing, Experience (pills only).
 */
export default function PersonalMarketplaceFilterPanel({
  coachType,
  setCoachType,
  experienceBand,
  setExperienceBand,
  priceBand,
  setPriceBand,
  onClearAll,
}) {
  const goalAny = coachType === '' && experienceBand === '';

  const pickGoal = (type) => {
    setExperienceBand('');
    setCoachType(type);
  };

  const pickExperience = (band) => {
    setCoachType('');
    setExperienceBand(band);
  };

  return (
    <div
      style={{
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        background: colors.surface1,
        padding: spacing[14],
      }}
    >
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: spacing[12] }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>Filters</span>
        <button
          type="button"
          onClick={onClearAll}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.primary,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          Clear
        </button>
      </div>

      <p style={labelStyle}>Goal</p>
      <PillRow>
        <Pill selected={goalAny} onClick={() => { setCoachType(''); setExperienceBand(''); }}>
          Any
        </Pill>
        <Pill selected={coachType === 'transformation'} onClick={() => pickGoal('transformation')}>
          Recomp &amp; lifestyle
        </Pill>
        <Pill selected={coachType === 'competition'} onClick={() => pickGoal('competition')}>
          Prep &amp; stage
        </Pill>
        <Pill selected={coachType === 'integrated'} onClick={() => pickGoal('integrated')}>
          Hybrid training
        </Pill>
      </PillRow>

      <p style={{ ...labelStyle, marginTop: spacing[14] }}>Pricing</p>
      <PillRow>
        <Pill selected={priceBand === ''} onClick={() => setPriceBand('')}>
          Any
        </Pill>
        <Pill selected={priceBand === 'has_pricing'} onClick={() => setPriceBand('has_pricing')}>
          Shows pricing
        </Pill>
        <Pill selected={priceBand === 'contact'} onClick={() => setPriceBand('contact')}>
          Contact only
        </Pill>
      </PillRow>

      <p style={{ ...labelStyle, marginTop: spacing[14] }}>Experience</p>
      <PillRow>
        <Pill selected={experienceBand === ''} onClick={() => setExperienceBand('')}>
          Any
        </Pill>
        <Pill selected={experienceBand === 'newer'} onClick={() => pickExperience('newer')}>
          Building habits
        </Pill>
        <Pill selected={experienceBand === 'advanced'} onClick={() => pickExperience('advanced')}>
          Advanced
        </Pill>
        <Pill selected={experienceBand === 'prep'} onClick={() => pickExperience('prep')}>
          Contest path
        </Pill>
      </PillRow>
    </div>
  );
}

/** @param {string} band */
export function coachMatchesExperienceBand(profile, band) {
  if (!band) return true;
  const focus = String(profile?.coach_focus || '').toLowerCase();
  if (band === 'newer') return focus === 'transformation';
  if (band === 'advanced') return focus === 'integrated';
  if (band === 'prep') return !!profile?.accepts_competition;
  return true;
}
