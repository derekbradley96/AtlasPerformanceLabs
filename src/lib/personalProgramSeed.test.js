import { describe, expect, it, vi } from 'vitest';
import { createPersonalProgramFromTemplate } from './personalProgramSeed';

/**
 * Minimal chainable Supabase mock: records every insert per table and
 * answers the .select() shapes createPersonalProgramFromTemplate uses.
 */
function makeSupabaseMock() {
  const inserts = { program_blocks: [], program_weeks: [], program_days: [], program_exercises: [], personal_program_assignments: [] };
  let dayIdCounter = 0;
  const from = vi.fn((table) => ({
    insert(rows) {
      const list = Array.isArray(rows) ? rows : [rows];
      inserts[table].push(...list);
      return {
        select() {
          if (table === 'program_blocks') {
            return { single: async () => ({ data: { id: 'block-1' }, error: null }) };
          }
          if (table === 'program_weeks') {
            return Promise.resolve({
              data: list.map((r, i) => ({ id: `week-${r.week_number ?? i + 1}`, week_number: r.week_number })),
              error: null,
            });
          }
          if (table === 'program_days') {
            return Promise.resolve({
              data: list.map((r) => ({ id: `day-${++dayIdCounter}`, week_id: r.week_id, day_number: r.day_number })),
              error: null,
            });
          }
          return Promise.resolve({ data: list, error: null });
        },
        then(resolve) {
          // Plain awaited insert (exercises, assignment insert)
          resolve({ data: null, error: null });
        },
      };
    },
    update() {
      return { eq: async () => ({ data: null, error: null }) };
    },
  }));
  return { client: { from }, inserts };
}

describe('createPersonalProgramFromTemplate', () => {
  it('seeds every week of the block, not just week 1', async () => {
    const { client, inserts } = makeSupabaseMock();
    const blockId = await createPersonalProgramFromTemplate(client, 'user-1', 3, { title: 'My starter plan', goal: 'muscle' });

    expect(blockId).toBe('block-1');
    expect(inserts.program_weeks.map((w) => w.week_number)).toEqual([1, 2, 3, 4]);

    // 3 training days per week × 4 weeks
    expect(inserts.program_days).toHaveLength(12);
    const daysPerWeek = new Map();
    for (const d of inserts.program_days) {
      daysPerWeek.set(d.week_id, (daysPerWeek.get(d.week_id) || 0) + 1);
    }
    expect([...daysPerWeek.values()]).toEqual([3, 3, 3, 3]);

    // Every day got real exercises, evenly across weeks
    expect(inserts.program_exercises.length % 4).toBe(0);
    expect(inserts.program_exercises.length).toBeGreaterThan(0);
    expect(inserts.program_exercises.every((e) => typeof e.exercise_name === 'string' && e.exercise_name.length > 0)).toBe(true);

    // Assignment activated for the new block
    expect(inserts.personal_program_assignments).toHaveLength(1);
    expect(inserts.personal_program_assignments[0]).toMatchObject({ profile_id: 'user-1', program_block_id: 'block-1', is_active: true });
  });

  it('clamps days per week into the 2-6 template range', async () => {
    const { client, inserts } = makeSupabaseMock();
    await createPersonalProgramFromTemplate(client, 'user-1', 9, { goal: 'fat_loss' });
    const perWeek = inserts.program_days.filter((d) => d.week_id === 'week-1').length;
    expect(perWeek).toBeLessThanOrEqual(6);
    expect(perWeek).toBeGreaterThanOrEqual(2);
  });
});
