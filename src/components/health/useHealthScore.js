/**
 * Memoized health score for a client. Returns phase-aware score, risk, flags, summary, phase.
 */
import { useMemo } from 'react';
import { getPhaseAwareHealthResult } from '@/lib/intelligence/healthScoreEngineBridge';
import * as sandbox from '@/lib/sandboxStore';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Returns { score, risk, flags, summary, phase } or null. Memoized on clientId + client + checkIns.
 * Pass client and checkIns when you have them (e.g. from parent state) to avoid stale data.
 */
export function useHealthScore(clientId, client = null, checkIns = null) {
  const resolvedClient = client ?? (clientId ? sandbox.getClientById(clientId) : null);
  const resolvedCheckIns = checkIns ?? (clientId ? sandbox.listCheckIns(clientId) ?? [] : []) ?? [];

  return useMemo(() => {
    if (!clientId) return null;
    const result = getPhaseAwareHealthResult(resolvedClient, resolvedCheckIns ?? []);
    if (!result) return null;
    return {
      score: result?.score ?? 0,
      risk: result?.risk ?? 'low',
      flags: result?.flags ?? [],
      summary: result?.summary ?? '',
      phase: capitalize(result?.phase ?? 'offseason'),
    };
  }, [clientId, resolvedClient, resolvedCheckIns]);
}
