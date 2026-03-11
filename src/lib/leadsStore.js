/**
 * Leads from /join/:slug onboarding funnel. localStorage-backed.
 * Tied to trainer by trainerSlug (trainer_id for demo is derived from slug).
 */
const KEY = 'atlas_join_leads';

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
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a lead from join form or consultation. */
export function createLead({ trainerSlug, trainerId, name, email, goal, phase, gymName, availability, notes, source = 'join_link' }) {
  const list = safeParse([]);
  const record = {
    id: nextId(),
    trainerSlug: trainerSlug || '',
    trainerId: trainerId || null,
    name: name || '',
    email: email || '',
    goal: goal || '',
    phase: phase || '',
    gymName: gymName || '',
    availability: availability || '',
    notes: notes || '',
    source,
    status: 'new',
    created_date: new Date().toISOString(),
  };
  list.unshift(record);
  safeSet(list);
  return record;
}

/** Create lead from public coach profile application form. Stores serviceSnapshot at time of application. */
export function createLeadFromApplication({
  trainerUserId,
  trainerProfileId,
  applicantName,
  email,
  phone,
  instagram,
  goal,
  timeline,
  budgetRange,
  trainingAge,
  gymAccess,
  equipment,
  injuries,
  availability,
  preferredServiceId,
  serviceSnapshot,
  notes,
}) {
  const list = safeParse([]);
  const now = new Date().toISOString();
  const record = {
    id: nextId(),
    trainerUserId: trainerUserId || '',
    trainerProfileId: trainerProfileId || null,
    trainerId: trainerUserId || null,
    trainerSlug: '',
    status: 'new',
    source: 'coach_profile',
    createdAt: now,
    updatedAt: now,
    created_date: now,
    applicantName: applicantName || '',
    name: applicantName || '',
    email: email || '',
    phone: phone || null,
    instagram: instagram || null,
    goal: goal || '',
    timeline: timeline || null,
    budgetRange: budgetRange || null,
    trainingAge: trainingAge || null,
    gymAccess: gymAccess || null,
    equipment: equipment || null,
    injuries: injuries || null,
    availability: availability || null,
    preferredServiceId: preferredServiceId || null,
    serviceSnapshot: serviceSnapshot || null,
    notes: notes || null,
  };
  list.unshift(record);
  safeSet(list);
  return record;
}

/** Get leads for a trainer (by trainerId, trainerUserId, or trainerSlug). */
export function getLeadsForTrainer(trainerIdOrSlug, options = {}) {
  const list = safeParse([]);
  return list.filter(
    (r) =>
      r.trainerId === trainerIdOrSlug ||
      r.trainerUserId === trainerIdOrSlug ||
      r.trainerSlug === trainerIdOrSlug
  );
}

/** Get lead by id. */
export function getLeadById(leadId) {
  const list = safeParse([]);
  return list.find((r) => r.id === leadId) ?? null;
}

/** Get all leads (for trainer list). */
export function getAllLeads() {
  return safeParse([]);
}

/** Update lead status. */
export function updateLeadStatus(leadId, status) {
  const list = safeParse([]);
  const idx = list.findIndex((r) => r.id === leadId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  list[idx] = { ...list[idx], status, updatedAt: now, updated_date: now };
  safeSet(list);
  return list[idx];
}

/** Update lead with any patch (e.g. clientId on convert, notes). */
export function updateLead(leadId, patch) {
  const list = safeParse([]);
  const idx = list.findIndex((r) => r.id === leadId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  list[idx] = { ...list[idx], ...patch, updatedAt: now, updated_date: now };
  safeSet(list);
  return list[idx];
}
