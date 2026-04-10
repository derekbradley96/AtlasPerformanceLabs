import { describe, it, expect } from 'vitest';
import {
  sanitizeExerciseLibraryPayload,
  validateExerciseLibraryPayload,
  normalizeMuscle,
  normalizeMovementPattern,
  normalizeEquipmentPrimary,
  ATLAS_EXERCISE_TAGS,
} from '@/lib/exerciseTaxonomy';

describe('exerciseTaxonomy', () => {
  it('normalizes muscles and movement from title case', () => {
    expect(normalizeMuscle('Chest')).toBe('chest');
    expect(normalizeMuscle('Hip')).toBe('glutes');
    expect(normalizeMovementPattern('Push')).toBe('push');
    expect(normalizeMovementPattern('Isolation')).toBe('isolation');
  });

  it('normalizes equipment to canonical slugs', () => {
    expect(normalizeEquipmentPrimary('Barbell')).toBe('barbell');
    expect(normalizeEquipmentPrimary('Medicine Ball')).toBe('medicine_ball');
    expect(normalizeEquipmentPrimary('TRX')).toBe('trx');
  });

  it('strips unknown tags and keeps closed vocabulary', () => {
    const row = sanitizeExerciseLibraryPayload({
      name: 'Test Press',
      tags: ['compound', 'random_garbage', 'ISOLATION'],
      movement_pattern: 'push',
      primary_muscle: 'chest',
      equipment_primary: 'barbell',
    });
    expect(row.tags.every((t) => ATLAS_EXERCISE_TAGS.includes(t))).toBe(true);
    expect(row.tags).toContain('compound');
    expect(row.tags).toContain('isolation');
    expect(row.tags).not.toContain('random_garbage');
  });

  it('validateExerciseLibraryPayload accepts a minimal valid row', () => {
    const { ok, errors } = validateExerciseLibraryPayload({
      name: 'Valid Row',
      equipment_primary: 'dumbbell',
    });
    expect(ok).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('validateExerciseLibraryPayload rejects missing name', () => {
    const { ok, errors } = validateExerciseLibraryPayload({
      equipment_primary: 'barbell',
    });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });
});
