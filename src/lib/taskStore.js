/**
 * Tasks for trainers. localStorage-backed. Maps to Supabase later.
 * Task: { id, title, dueAt?, priority, status, relatedClientId?, type }
 */
const KEY = 'atlas_tasks';

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

function nextId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addTask({ title, dueAt, priority = 'med', status = 'open', relatedClientId, type }) {
  const list = safeParse([]);
  const record = {
    id: nextId(),
    title: title || 'Untitled',
    dueAt: dueAt || null,
    priority: priority || 'med',
    status: status || 'open',
    relatedClientId: relatedClientId || null,
    type: type || null,
    created_date: new Date().toISOString(),
  };
  list.unshift(record);
  safeSet(list);
  return record;
}

export function getTasks(trainerIdOrOptions = {}) {
  const list = safeParse([]);
  if (typeof trainerIdOrOptions === 'object' && trainerIdOrOptions.clientId) {
    return list.filter((t) => t.relatedClientId === trainerIdOrOptions.clientId);
  }
  return list;
}

export function updateTaskStatus(taskId, status) {
  const list = safeParse([]);
  const idx = list.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], status, updated_date: new Date().toISOString() };
  safeSet(list);
  return list[idx];
}
