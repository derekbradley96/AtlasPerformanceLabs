/**
 * Client stubs created when converting a lead to client. Merged with mockData clients in getClients.
 */
const KEY = 'atlas_client_stubs';

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
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

function nextId() {
  return `client-stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a client stub from a lead (on Convert to client). Returns the new client record.
 * @param {{ leadId: string; trainerId: string; fullName: string; email: string; client_type?: 'general'|'prep' }} payload
 */
export function createClientStub(payload) {
  const list = load();
  const client = {
    id: nextId(),
    user_id: null,
    trainer_id: payload.trainerId,
    full_name: payload.fullName || 'New client',
    email: payload.email || '',
    client_type: payload.client_type ?? 'general',
    subscription_status: 'active',
    status: 'on_track',
    payment_overdue: false,
    last_check_in_at: null,
    phase: 'Maintenance',
    phaseStartedAt: new Date().toISOString().slice(0, 10),
    created_date: new Date().toISOString(),
    from_lead_id: payload.leadId,
  };
  list.push(client);
  save(list);
  return client;
}

/**
 * Return all stub clients (for selectors / getClients merge).
 */
export function getStubClients() {
  return load();
}

/**
 * Create a client stub manually (e.g. from Sandbox UI). Returns the new client record.
 * @param {{ trainerId: string; fullName: string; email: string; phase?: string; goal?: string; status?: string; subscription_status?: string; payment_overdue?: boolean; show_date?: string }}
 */
export function createManualClientStub({ trainerId, fullName, email, phase, goal, status, subscription_status, payment_overdue, show_date }) {
  const list = load();
  const now = new Date().toISOString();
  const client = {
    id: nextId(),
    user_id: null,
    trainer_id: trainerId,
    full_name: fullName || 'New client',
    email: email || '',
    phase: phase || 'Maintenance',
    goal: goal ?? null,
    show_date: show_date ?? null,
    status: status === 'at_risk' || status === 'needs_review' || status === 'attention' ? status : 'on_track',
    subscription_status: subscription_status ?? 'active',
    payment_overdue: Boolean(payment_overdue),
    last_check_in_at: null,
    phaseStartedAt: new Date().toISOString().slice(0, 10),
    created_date: now,
    created_at: now,
    updated_at: now,
  };
  list.push(client);
  save(list);
  return client;
}

/**
 * Clear all stub clients (reset sandbox clients).
 */
export function resetStubClients() {
  save([]);
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed 5 test clients for sandbox: 2 prep (daysOut < 21), 1 peak week (daysOut < 7), 1 bulk, 1 general.
 * Uses realistic fields: id, trainer_id, full_name, email, phase, goal, show_date, status,
 * subscription_status, payment_overdue, created_at, updated_at.
 * @param {string} trainerId
 * @returns {number} count of clients added
 */
export function seedTestClients(trainerId) {
  resetStubClients();
  const today = new Date().toISOString().slice(0, 10);

  createManualClientStub({
    trainerId,
    fullName: 'Alex Rivera',
    email: 'alex.rivera@sandbox.example',
    phase: 'Prep',
    goal: 'Comp prep',
    show_date: addDays(today, 14),
    status: 'on_track',
    subscription_status: 'active',
    payment_overdue: false,
  });
  createManualClientStub({
    trainerId,
    fullName: 'Jordan Shaw',
    email: 'jordan.shaw@sandbox.example',
    phase: 'Prep',
    goal: 'Comp prep',
    show_date: addDays(today, 18),
    status: 'needs_review',
    subscription_status: 'active',
    payment_overdue: false,
  });
  createManualClientStub({
    trainerId,
    fullName: 'Sam Chen',
    email: 'sam.chen@sandbox.example',
    phase: 'Peak Week',
    goal: 'Comp prep',
    show_date: addDays(today, 5),
    status: 'on_track',
    subscription_status: 'active',
    payment_overdue: false,
  });
  createManualClientStub({
    trainerId,
    fullName: 'Morgan Blake',
    email: 'morgan.blake@sandbox.example',
    phase: 'Bulk',
    goal: 'Offseason',
    show_date: null,
    status: 'on_track',
    subscription_status: 'active',
    payment_overdue: false,
  });
  createManualClientStub({
    trainerId,
    fullName: 'Casey Drew',
    email: 'casey.drew@sandbox.example',
    phase: 'Maintenance',
    goal: null,
    show_date: null,
    status: 'on_track',
    subscription_status: 'active',
    payment_overdue: false,
  });

  return load().length;
}

const REALISTIC_PHASES = [
  { phase: 'Bulk', status: 'on_track', payment_overdue: false },
  { phase: 'Cut', status: 'at_risk', payment_overdue: false },
  { phase: 'Maintenance', status: 'on_track', payment_overdue: false },
  { phase: 'Prep Week 10', status: 'on_track', payment_overdue: true },
  { phase: 'Peak Week', status: 'at_risk', payment_overdue: false },
];

const REALISTIC_NAMES = ['Alex Rivera', 'Jordan Shaw', 'Sam Chen', 'Morgan Blake', 'Casey Drew'];

/**
 * Seed 5 realistic stub clients for a trainer (Bulk, Cut, Maintenance, Prep Week 10, Peak Week).
 * @param {string} trainerId
 * @returns {number} count of clients added
 */
export function seedRealisticStubClients(trainerId) {
  resetStubClients();
  REALISTIC_PHASES.forEach(({ phase, status, payment_overdue }, i) => {
    const name = REALISTIC_NAMES[i];
    const base = name.toLowerCase().replace(/\s+/, '.');
    createManualClientStub({
      trainerId,
      fullName: name,
      email: `${base}@sandbox.example`,
      phase,
      status,
      payment_overdue,
    });
  });
  return load().length;
}
