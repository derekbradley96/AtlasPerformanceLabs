import { describe, it, expect } from 'vitest';
import { scoreExerciseForContext, rankExercisesForSlot } from '@/lib/exerciseScoringEngine';

describe('exerciseScoringEngine', () => {
  const baseExercise = {
    id: 'ex-1',
    name: 'Barbell Bench Press',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_primary: 'barbell',
    best_for_goals: ['hypertrophy', 'strength'],
    fatigue_cost: 'high',
    skill_requirement: 'moderate',
    body_context_tags: ['beginner_friendly'],
    best_in_session_window: ['main'],
    program_roles: ['main_lift'],
  };

  it('returns deterministic score + reasons', () => {
    const result = scoreExerciseForContext(baseExercise, {
      goal: 'muscle',
      equipmentAccess: ['barbell'],
      slot: { movementPattern: 'push', targetMuscles: ['chest'], sessionWindow: 'main' },
    });
    expect(result.totalScore).toBeGreaterThan(60);
    expect(result.reasonSummary.length).toBeGreaterThan(0);
    expect(result.subScores.goalFit).toBeGreaterThan(10);
  });

  it('ranks better fitting exercise first', () => {
    const exercises = [
      baseExercise,
      { ...baseExercise, id: 'ex-2', name: 'Cable Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', equipment_primary: 'cable' },
    ];
    const ranked = rankExercisesForSlot(exercises, {
      goal: 'muscle',
      equipmentAccess: ['barbell'],
      slot: { movementPattern: 'push', targetMuscles: ['chest'], sessionWindow: 'main' },
    });
    expect(ranked[0].exercise.id).toBe('ex-1');
  });
});

