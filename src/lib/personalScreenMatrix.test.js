import { describe, it, expect } from 'vitest';
import {
  resolvePersonalUXContext,
  getPersonalScreenFeatures,
  personalTodayFuelSignalTitle,
  personalTodayFuelInsightFallback,
  getPersonalNutritionPageCopy,
} from '@/lib/personalScreenMatrix';

function ctx({ goal = 'muscle', tier = 'basic' } = {}) {
  return resolvePersonalUXContext({
    profile: { personal_goal: goal, personal_plan_tier: tier },
    user: {},
  });
}

describe('personalScreenMatrix', () => {
  it('maps goals to axes and tier flags (6 combinations smoke)', () => {
    const basicBuild = ctx({ goal: 'build_muscle', tier: 'basic' });
    expect(basicBuild.goalAxis).toBe('build');
    expect(basicBuild.isBasic).toBe(true);
    expect(basicBuild.isPrepGoal).toBe(false);

    const enhancedCut = ctx({ goal: 'lose_fat', tier: 'enhanced' });
    expect(enhancedCut.goalAxis).toBe('cut');
    expect(enhancedCut.isEnhanced).toBe(true);

    const basicPrep = ctx({ goal: 'prep', tier: 'basic' });
    expect(basicPrep.goalAxis).toBe('prep');
    const f = getPersonalScreenFeatures(basicPrep);
    expect(f.showPrepPrecisionNutrition).toBe(false);

    const enhancedPrep = ctx({ goal: 'competition', tier: 'enhanced' });
    expect(enhancedPrep.isPrepGoal).toBe(true);
    expect(getPersonalScreenFeatures(enhancedPrep).showPrepPrecisionNutrition).toBe(true);
  });

  it('does not leak prep nutrition subtitle into build', () => {
    const build = getPersonalNutritionPageCopy(ctx({ goal: 'hypertrophy', tier: 'enhanced' })).pageSubtitle;
    const prep = getPersonalNutritionPageCopy(ctx({ goal: 'prep', tier: 'enhanced' })).pageSubtitle;
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
