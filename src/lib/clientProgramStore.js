/**
 * Per-client program (client-specific plan). Versioned; not the global template library.
 * ClientProgram: { clientId, version, effectiveDate, notes, days[], changelog[] }
 * Update today vs Update next week; changelog entry per version.
 * localStorage-backed; maps to Supabase later.
 */
const KEY = 'atlas_client_programs';

function safeParse(fallback) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (e) {}
}

/** Get current program for client (latest version). */
export function getClientProgram(clientId) {
  const list = safeParse([]);
  const byClient = list.filter((p) => p.clientId === clientId);
  if (!byClient.length) return null;
  return byClient.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
}

/** Get full history (all versions) for client. */
export function getClientProgramHistory(clientId) {
  const list = safeParse([]);
  return list
    .filter((p) => p.clientId === clientId)
    .sort((a, b) => (b.version || 0) - (a.version || 0));
}

/** Create or update program. effectiveDate: today or next week. */
export function setClientProgram(clientId, payload, options = {}) {
  const { updateTiming = 'today' } = options; // 'today' | 'next_week'
  const list = safeParse([]);
  const existing = getClientProgram(clientId);
  const version = existing ? (existing.version || 1) + 1 : 1;
  const now = new Date();
  const effectiveDate =
    updateTiming === 'next_week'
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : now.toISOString().slice(0, 10);
  const changelogEntry = {
    version,
    at: now.toISOString(),
    note: payload.changelogNote || `Version ${version}`,
  };
  const program = {
    clientId,
    version,
    effectiveDate,
    notes: payload.notes ?? existing?.notes ?? '',
    days: payload.days ?? existing?.days ?? [],
    changelog: [...(existing?.changelog ?? []), changelogEntry],
    updated_date: now.toISOString(),
  };
  list.push(program);
  safeSet(list);
  return program;
}
