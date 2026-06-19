import { describe, it, expect } from 'vitest';
import {
  resolvePersonalUXContext,
  getPersonalScreenFeatures,
  personalTodayFuelSignalTitle,
  personalTodayFuelInsightFallback,
  getPersonalNutritionPageCopy,
} from '@/lib/personalScreenMatrix';

function ctx({ goal = 'muscle', tier = 'free' } = {}) {
  return resolvePersonalUXContext({
    profile: { role: 'personal', personal_goal: goal, personal_plan_tier: tier },
    user: { role: 'personal' },
  });
}

describe('personalScreenMatrix', () => {
  it('maps goals to axes and tier flags (personal is always free)', () => {
    const build = ctx({ goal: 'build_muscle', tier: 'free' });
    expect(build.goalAxis).toBe('build');
    expect(build.tier).toBe('free');
    expect(build.isEnhanced).toBe(true);
    expect(build.isPrepGoal).toBe(false);

    const cut = ctx({ goal: 'lose_fat', tier: 'basic' });
    expect(cut.goalAxis).toBe('cut');
    expect(cut.tier).toBe('free');
    expect(cut.isEnhanced).toBe(true);

    const prep = ctx({ goal: 'prep', tier: 'free' });
    expect(prep.goalAxis).toBe('prep');
    expect(getPersonalScreenFeatures(prep).showPrepPrecisionNutrition).toBe(true);

    const competition = ctx({ goal: 'competition', tier: 'free' });
    expect(competition.isPrepGoal).toBe(true);
    expect(getPersonalScreenFeatures(competition).showPrepPrecisionNutrition).toBe(true);
  });

  it('does not leak prep nutrition subtitle into build', () => {
    const build = getPersonalNutritionPageCopy(ctx({ goal: 'hypertrophy', tier: 'free' })).pageSubtitle;
    const prep = getPersonalNutritionPageCopy(ctx({ goal: 'prep', tier: 'free' })).pageSubtitle;
    expect(build.toLowerCase()).not.toContain('prep-lite');
    expect(prep.toLowerCase()).toContain('phase');
  });

  it('fuel titles stay goal-specific', () => {
    const low = personalTodayFuelSignalTitle({ proteinPct: 50, caloriePct: 90, goalAxis: 'cut' });
    expect(low.toLowerCase()).toContain('cut');
    const buildLow = personalTodayFuelSignalTitle({ proteinPct: 50, caloriePct: 90, goalAxis: 'build' });
    expect(buildLow.toLowerCase()).not.toContain('cut');

    const fb = personalTodayFuelInsightFallback('cut');
    expect(fb.toLowerCase()).toContain('cut');
    expect(personalTodayFuelInsightFallback('build').toLowerCase()).toContain('training');
  });
});
