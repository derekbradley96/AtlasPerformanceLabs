/**
 * Lightweight log of trainer/client actions for timeline (payment reminder sent, intervention opened/ack/snooze, etc.).
 */
const KEY = 'atlas_timeline_action_log';
const MAX = 500;

function safeGet(): Array<{ id: string; clientId: string; action: string; at: string; meta?: Record<string, unknown> }> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeSet(list: Array<{ id: string; clientId: string; action: string; at: string; meta?: Record<string, unknown> }>) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    }
  } catch {}
}

export function appendActionLog(clientId: string, action: string, meta?: Record<string, unknown>) {
  const list = safeGet();
  list.push({
    id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    clientId,
    action,
    at: new Date().toISOString(),
    meta,
  });
  safeSet(list);
}

export function getActionLogForClient(clientId: string): Array<{ id: string; clientId: string; action: string; at: string; meta?: Record<string, unknown> }> {
  return safeGet().filter((e) => e.clientId === clientId);
}
