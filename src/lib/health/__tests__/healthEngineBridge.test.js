import { describe, expect, it } from 'vitest';
import { getClientHealth } from '../healthEngineBridge';

/**
 * The live check-in form writes nutrition_adherence (0-100), mood_level /
 * stress_level (1-10), digestion_score (1-10), steps_avg — not the field
 * names/scales the engine reads. These tests pin the bridge mapping so the
 * coach-facing health score reflects real submissions, not silent defaults.
 */

const client = { id: 'c1', full_name: 'Test Client' };

function submittedCheckin(overrides = {}) {
  return {
    id: 'ci1',
    client_id: 'c1',
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('getClientHealth input mapping', () => {
  it('maps nutrition_adherence to the adherence penalty', () => {
    const result = getClientHealth(client, [submittedCheckin({ nutrition_adherence: 45 })], null);
    expect(result.reasons).toContain('Adherence below 50%');
  });

  it('maps mood_level (1-10) onto the engine mood scale', () => {
    const result = getClientHealth(client, [submittedCheckin({ mood_level: 4 })], null);
    expect(result.reasons).toContain('Low mood');
  });

  it('maps stress_level (1-10) onto the engine stress scale', () => {
    const high = getClientHealth(client, [submittedCheckin({ stress_level: 9 })], null);
    expect(high.reasons).toContain('High stress');
    const moderate = getClientHealth(client, [submittedCheckin({ stress_level: 5 })], null);
    expect(moderate.reasons).not.toContain('High stress');
  });

  it('derives a digestion flag from a low digestion_score', () => {
    const result = getClientHealth(client, [submittedCheckin({ digestion_score: 2 })], null);
    expect(result.reasons).toContain('Digestion issues noted');
  });

  it('does not penalise steps when the check-in reported none', () => {
    const result = getClientHealth(client, [submittedCheckin({})], null);
    expect(result.reasons).not.toContain('Steps below target');
  });

  it('penalises steps when steps_avg is reported low', () => {
    const result = getClientHealth(client, [submittedCheckin({ steps_avg: 2000 })], null);
    expect(result.reasons).toContain('Steps below target');
  });

  it('healthy submission scores green', () => {
    const result = getClientHealth(
      client,
      [
        submittedCheckin({
          nutrition_adherence: 95,
          mood_level: 8,
          stress_level: 3,
          digestion_score: 8,
          steps_avg: 11000,
          sleep_hours: 7.5,
          weight_kg: 80,
        }),
      ],
      null
    );
    expect(result.riskLevel).toBe('green');
  });
});
