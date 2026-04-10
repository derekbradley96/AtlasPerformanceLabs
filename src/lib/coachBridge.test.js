import { describe, it, expect } from 'vitest';
import { deriveCoachBridgeMoment, COACH_BRIDGE_VARIANTS } from '@/lib/coachBridge';

describe('deriveCoachBridgeMoment', () => {
  it('basic tier: prep-style goal on home returns prep', () => {
    const m = deriveCoachBridgeMoment({
      surface: 'home',
      tier: 'basic',
      goalId: 'competition_prep',
      completedLast28d: 0,
    });
    expect(m?.variant).toBe(COACH_BRIDGE_VARIANTS.PREP);
    expect(m?.bridgeSource).toBe('from_prep');
  });

  it('basic tier: plateau-eligible progress returns plateau', () => {
    const weightSeries = [{ weight: 80 }, { weight: 80.1 }, { weight: 80 }, { weight: 79.9 }];
    const m = deriveCoachBridgeMoment({
      surface: 'progress',
      tier: 'basic',
      goalId: 'build_muscle',
      completedLast28d: 5,
      nutritionAdherenceAvg: 60,
      weightSeries,
    });
    expect(m?.variant).toBe(COACH_BRIDGE_VARIANTS.PLATEAU);
  });

  it('basic tier: repeated week gap returns inconsistency moment', () => {
    const m = deriveCoachBridgeMoment({
      surface: 'home',
      tier: 'basic',
      goalId: 'maintain',
      weeklyWorkoutDone: 1,
      weeklyWorkoutTarget: 4,
      workoutStreak: 0,
      completedLast28d: 7,
    });
    expect(m?.reasonKey).toBe('inconsistency');
    expect(m?.variant).toBe(COACH_BRIDGE_VARIANTS.ACCOUNTABILITY);
  });

  it('enhanced tier: strong engagement on home returns advanced', () => {
    const m = deriveCoachBridgeMoment({
      surface: 'home',
      tier: 'enhanced',
      goalId: 'general_fitness',
      weeklyWorkoutDone: 4,
      weeklyWorkoutTarget: 4,
      workoutStreak: 3,
      completedLast28d: 12,
      nutritionAdherenceAvg: 80,
    });
    expect(m?.variant).toBe(COACH_BRIDGE_VARIANTS.ADVANCED_GOAL);
  });

  it('basic tier: strong engagement alone does not surface advanced on home', () => {
    const m = deriveCoachBridgeMoment({
      surface: 'home',
      tier: 'basic',
      goalId: 'general_fitness',
      weeklyWorkoutDone: 4,
      weeklyWorkoutTarget: 4,
      workoutStreak: 3,
      completedLast28d: 12,
      nutritionAdherenceAvg: 80,
    });
    expect(m).toBeNull();
  });

  it('today: low readiness history returns recovery nudge (enhanced)', () => {
    const m = deriveCoachBridgeMoment({
      surface: 'today',
      tier: 'enhanced',
      goalId: 'cut',
      readinessHistory: [{ readiness_score: 3 }, { readiness_score: 4 }],
      completedLast28d: 4,
      weeklyWorkoutDone: 2,
      weeklyWorkoutTarget: 4,
    });
    expect(m?.variant).toBe(COACH_BRIDGE_VARIANTS.SOFT_NUDGE);
    expect(m?.bridgeSource).toBe('from_low_readiness');
  });
});
