import { describe, it, expect } from 'vitest';
import { chooseSplitForContext, generateStarterProgram } from '@/lib/autoProgramBuilder';

describe('autoProgramBuilder', () => {
  const candidates = [
    {
      id: 'sq',
      name: 'Back Squat',
      display_name: 'Back Squat',
      movement_pattern: 'squat',
      primary_muscle: 'quads',
      equipment_primary: 'barbell',
      best_for_goals: ['hypertrophy', 'strength'],
      best_in_session_window: ['main'],
      fatigue_cost: 'high',
      skill_requirement: 'moderate',
      program_roles: ['main_lift'],
    },
    {
      id: 'bp',
      name: 'Bench Press',
      display_name: 'Bench Press',
      movement_pattern: 'push',
      primary_muscle: 'chest',
      equipment_primary: 'barbell',
      best_for_goals: ['hypertrophy', 'strength'],
      best_in_session_window: ['main'],
      fatigue_cost: 'high',
      skill_requirement: 'moderate',
      program_roles: ['main_lift'],
    },
    {
      id: 'row',
      name: 'Barbell Row',
      display_name: 'Barbell Row',
      movement_pattern: 'pull',
      primary_muscle: 'back',
      equipment_primary: 'barbell',
      best_for_goals: ['hypertrophy'],
      best_in_session_window: ['secondary'],
      fatigue_cost: 'moderate',
      skill_requirement: 'moderate',
      program_roles: ['secondary'],
    },
  ];

  it('chooses expected split for 4 days', () => {
    const split = chooseSplitForContext({ goal: 'muscle', daysPerWeek: 4 });
    expect(split.splitId).toBe('upper_lower_x2');
    expect(split.dayTitles).toHaveLength(4);
  });

  it('builds explainable starter program for coach (Personal auto-gen disabled by policy)', () => {
    const program = generateStarterProgram({
      role: 'coach',
      personalPlanTier: 'enhanced',
      goal: 'muscle',
      daysPerWeek: 3,
      equipmentAccess: ['barbell'],
      exerciseCandidates: candidates,
    });
    expect(program).not.toBeNull();
    expect(program.days.length).toBe(3);
    expect(program.days[0].exercises.length).toBeGreaterThan(0);
    expect(program.explainability.length).toBeGreaterThan(0);
  });

  it('does not auto-generate starter program for Personal Basic', () => {
    const program = generateStarterProgram({
      role: 'personal',
      personalPlanTier: 'basic',
      goal: 'muscle',
      daysPerWeek: 3,
      exerciseCandidates: candidates,
    });
    expect(program).toBeNull();
  });
});

