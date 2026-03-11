/**
 * Audit log for key actions. Uses models/auditEvent shape.
 */
const KEY = 'atlas_audit_log';
const MAX_EVENTS = 500;

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_EVENTS)));
  } catch {}
}

function nextId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Log an audit event.
 * @param {{ actorUserId: string; ownerTrainerUserId: string; entityType: string; entityId?: string; action: string; before?: unknown; after?: unknown }}
 */
export function logAuditEvent({ actorUserId, ownerTrainerUserId, entityType, entityId, action, before, after }) {
  const list = load();
  list.push({
    id: nextId(),
    actorUserId,
    ownerTrainerUserId,
    entityType,
    entityId,
    action,
    before,
    after,
    createdAt: new Date().toISOString(),
  });
  save(list);
}

/** List recent events for an owner (e.g. for audit trail UI). */
export function listAuditEvents(ownerTrainerUserId, limit = 50) {
  return load()
    .filter((e) => e.ownerTrainerUserId === ownerTrainerUserId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}
