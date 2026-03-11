/**
 * Shared health/phase helpers. No imports from selectors, healthScoreService, or intelligence.
 * Use this to avoid circular dependencies between health score, at-risk, and selectors.
 */

export type PhaseKey = 'cut' | 'bulk' | 'maintenance';

export function normalizePhase(phase: unknown): PhaseKey {
  if (!phase || typeof phase !== 'string') return 'maintenance';
  const p = String(phase).toLowerCase().replace(/\s/g, '');
  if (p === 'cut') return 'cut';
  if (p === 'bulk' || p === 'leanbulk') return 'bulk';
  return 'maintenance';
}
