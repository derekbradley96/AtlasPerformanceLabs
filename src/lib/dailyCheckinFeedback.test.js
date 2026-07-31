import { describe, expect, it } from 'vitest';
import { buildPersonalTodaysAdjustment } from '@/lib/dailyCheckinFeedback';

// Regression: the card used to claim "volume slightly reduced" purely from
// decision.type — even for users with no programme at all (or auto-adjust
// off), where applyProgramAdjustment returned null and nothing was changed.
describe('buildPersonalTodaysAdjustment honesty', () => {
  const decision = (type, reason) => ({ decision: { type, reason } });

  it('reduce_volume with an applied adjustment states the change', () => {
    const adj = buildPersonalTodaysAdjustment({
      ...decision('reduce_volume', 'Adjusted due to fatigue'),
      programAdjustment: { id: 'row-1' },
    });
    expect(adj.volume).toMatch(/^Slightly reduced/);
    expect(adj.reason).toBe('Adjusted due to fatigue');
  });

  it('reduce_volume with NO applied adjustment phrases it as advice', () => {
    const adj = buildPersonalTodaysAdjustment({
      ...decision('reduce_volume', 'Adjusted due to fatigue'),
      programAdjustment: null,
    });
    expect(adj.volume).toMatch(/^Suggested:/);
    expect(adj.reason).toMatch(/not changed automatically/);
    expect(adj.volume).not.toMatch(/reduced \(/);
  });

  it('adjust_plan with NO applied adjustment phrases it as advice', () => {
    const adj = buildPersonalTodaysAdjustment({
      ...decision('adjust_plan', 'Adjusted because progress stalled'),
      programAdjustment: null,
    });
    expect(adj.volume).toMatch(/^Suggested:/);
    expect(adj.reason).toMatch(/not changed automatically/);
  });

  it('adjust_plan with an applied adjustment states the change', () => {
    const adj = buildPersonalTodaysAdjustment({
      ...decision('adjust_plan', 'Adjusted because progress stalled'),
      programAdjustment: { id: 'row-2' },
    });
    expect(adj.volume).toMatch(/^Slightly increased/);
  });

  it('on_track never claims a change', () => {
    const adj = buildPersonalTodaysAdjustment(decision('on_track', 'On track'));
    expect(adj.volume).toMatch(/^No change/);
  });
});
