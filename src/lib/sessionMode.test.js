import { describe, it, expect } from 'vitest';
import { deriveSessionModeState } from '@/lib/sessionMode';

describe('deriveSessionModeState', () => {
  it('returns no-certainty prompt when check-in missing', () => {
    const state = deriveSessionModeState({ readinessLogged: false });
    expect(state.mode).toBe(null);
    expect(state.badge).toBe(null);
    expect(state.explanation.toLowerCase()).toContain('check-in');
  });

  it('classifies heavy when readiness is strong and fuel is adequate', () => {
    const state = deriveSessionModeState({
      readinessLogged: true,
      checkinInputs: { energy: 5, recovery: 4, sleep_quality: 4, stress: 2, appetite: 4 },
      caloriePct: 90,
      proteinPct: 92,
    });
    expect(state.mode).toBe('heavy');
    expect(state.badge).toBe('Heavy');
  });

  it('classifies light on strong low-readiness signal', () => {
    const state = deriveSessionModeState({
      readinessLogged: true,
      checkinInputs: { energy: 2, recovery: 4, sleep_quality: 3, stress: 2, appetite: 3 },
      caloriePct: 88,
      proteinPct: 90,
    });
    expect(state.mode).toBe('light');
    expect(state.badge).toBe('Light');
  });

  it('classifies moderate for mixed readiness', () => {
    const state = deriveSessionModeState({
      readinessLogged: true,
      checkinInputs: { energy: 3, recovery: 3, sleep_quality: 3, stress: 3, appetite: 3 },
      caloriePct: 82,
      proteinPct: 80,
    });
    expect(state.mode).toBe('moderate');
    expect(state.badge).toBe('Moderate');
  });
});

