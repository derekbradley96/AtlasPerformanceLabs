import { describe, expect, it, vi } from 'vitest';
import {
  buildCanonicalClientInsertRow,
  deriveDeliveryContextForInsert,
  normalizeClientTypeInput,
  validateCanonicalCoachClientRow,
} from './supabaseClientsRepo';

describe('supabaseClientsRepo client creation', () => {
  it('normalizes client types', () => {
    expect(normalizeClientTypeInput('COMPETITION')).toBe('competition');
    expect(normalizeClientTypeInput('integrated')).toBe('integrated');
    expect(normalizeClientTypeInput('bogus')).toBe('transformation');
  });

  it('derives delivery_context', () => {
    expect(deriveDeliveryContextForInsert('competition', false)).toBe('competition');
    expect(deriveDeliveryContextForInsert('integrated', false)).toBe('transformation');
    expect(deriveDeliveryContextForInsert('integrated', true)).toBe('competition');
    expect(deriveDeliveryContextForInsert('transformation', true)).toBe('transformation');
  });

  it('builds insert row with persisted optional fields', () => {
    const { row, clientType, prepShowDate } = buildCanonicalClientInsertRow('coach-uuid-1', {
      full_name: '  Test Client ',
      goal: 'bulk',
      start_date: '2026-01-15',
      email: 'a@b.com',
      gym_equipment: ['Full Gym', 'Dumbbells'],
      client_journey: 'competition',
      show_date: '2026-06-01',
      federation: 'NPC',
    });
    expect(clientType).toBe('competition');
    expect(prepShowDate).toBe('2026-06-01');
    expect(row.name).toBe('Test Client');
    expect(row.coach_id).toBe('coach-uuid-1');
    expect(row.trainer_id).toBe('coach-uuid-1');
    expect(row.client_type).toBe('competition');
    expect(row.delivery_context).toBe('competition');
    expect(row.goals).toBe('bulk');
    expect(row.email).toBe('a@b.com');
    expect(row.start_date).toBe('2026-01-15');
    expect(row.show_date).toBe('2026-06-01');
    expect(row.gym_equipment_json).toEqual(['Full Gym', 'Dumbbells']);
  });

  it('integrated without show date omits show_date and uses transformation delivery', () => {
    const { row } = buildCanonicalClientInsertRow('c1', {
      name: 'Hybrid',
      client_type: 'integrated',
    });
    expect(row.client_type).toBe('integrated');
    expect(row.delivery_context).toBe('transformation');
    expect(row.show_date).toBeUndefined();
  });

  it('merges optional coach columns (user_id, baseline_weight, onboarding_notes, phase)', () => {
    const { row } = buildCanonicalClientInsertRow('coach-a', {
      name: 'Linked',
      user_id: '11111111-1111-1111-1111-111111111111',
      baseline_weight: 82.5,
      onboarding_notes: 'From migration',
      phase: 'Bulk',
      billing_status: 'pending',
    });
    expect(row.user_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(row.baseline_weight).toBe(82.5);
    expect(row.onboarding_notes).toBe('From migration');
    expect(row.phase).toBe('bulk');
    expect(row.billing_status).toBe('pending');
  });

  it('validateCanonicalCoachClientRow accepts aligned coach_id and trainer_id', () => {
    expect(() =>
      validateCanonicalCoachClientRow(
        { coach_id: 'x', trainer_id: 'x', name: 'N' },
        'test'
      )
    ).not.toThrow();
  });

  it('validateCanonicalCoachClientRow flags mismatched ids (logs; throws in dev)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      validateCanonicalCoachClientRow({ coach_id: 'a', trainer_id: 'b', name: 'N' }, 'test')
    ).toThrow(/coach_id !== trainer_id/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
