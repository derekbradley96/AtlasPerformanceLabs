import { describe, expect, it } from 'vitest';
import {
  isPersonalPrepGoal,
  resolvePrepPrecisionTierForCoachView,
  resolvePrepPrecisionAccess,
} from '@/lib/prepPrecisionAccess';

describe('prepPrecisionAccess', () => {
  it('detects personal prep goal labels', () => {
    expect(isPersonalPrepGoal('Competition prep')).toBe(true);
    expect(isPersonalPrepGoal('competition_prep')).toBe(true);
    expect(isPersonalPrepGoal('Fat loss')).toBe(false);
  });

  it('hides prep precision for transformation coaches', () => {
    expect(resolvePrepPrecisionTierForCoachView({ coachFocus: 'transformation', clientRow: { delivery_context: 'competition' } })).toBe(
      'hidden'
    );
  });

  it('shows full prep precision for competition coaches regardless of client delivery row', () => {
    expect(resolvePrepPrecisionTierForCoachView({ coachFocus: 'competition', clientRow: { delivery_context: 'transformation' } })).toBe(
      'full'
    );
  });

  it('integrated coach: only competition-delivery clients get full tier', () => {
    expect(
      resolvePrepPrecisionTierForCoachView({
        coachFocus: 'integrated',
        clientRow: { delivery_context: 'competition' },
      })
    ).toBe('full');
    expect(
      resolvePrepPrecisionTierForCoachView({
        coachFocus: 'integrated',
        clientRow: { delivery_context: 'transformation' },
      })
    ).toBe('hidden');
  });

  it('client tier respects competition delivery', () => {
    expect(
      resolvePrepPrecisionAccess({
        role: 'client',
        resolvedAccess: { isClientCompetitionDelivery: true },
        clientLinkedResolved: true,
      }).tier
    ).toBe('full');
    expect(
      resolvePrepPrecisionAccess({
        role: 'client',
        resolvedAccess: { isClientCompetitionDelivery: false },
        clientLinkedResolved: true,
      }).tier
    ).toBe('hidden');
  });

  it('client hides while linked row unresolved', () => {
    expect(
      resolvePrepPrecisionAccess({
        role: 'client',
        resolvedAccess: { isClientCompetitionDelivery: true },
        clientLinkedResolved: false,
      }).tier
    ).toBe('hidden');
  });

  it('personal prep-lite requires Enhanced tier', () => {
    expect(
      resolvePrepPrecisionAccess({
        role: 'personal',
        personalPlanTier: 'basic',
        personalPrimaryGoal: 'Competition prep',
        clientLinkedResolved: true,
      }).tier
    ).toBe('hidden');
    expect(
      resolvePrepPrecisionAccess({
        role: 'personal',
        personalPlanTier: 'enhanced',
        personalPrimaryGoal: 'Competition prep',
        clientLinkedResolved: true,
      }).tier
    ).toBe('light');
  });
});
