/**
 * Loyalty award events (1, 3, 6, 12 months with trainer). Stored so we show modal once and list in Achievements.
 */
const KEY = 'atlas_loyalty_awards';

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
  return `loy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MONTHS_MILESTONES = [1, 2, 3, 6, 12]; // 30, 60, 90, 180, 365 days

/** Get months with trainer from client.created_date or trainer_client created_at. Returns 0 for invalid dates. */
export function getMonthsWithTrainer(createdAt) {
  if (!createdAt) return 0;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const months = Math.floor((now.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
  return Number.isFinite(months) && months >= 0 ? months : 0;
}

/** Get the next milestone month not yet awarded (e.g. 1, 3, 6, 12). */
export function getNextMilestoneMonth(monthsWithTrainer) {
  return MONTHS_MILESTONES.find((m) => m > monthsWithTrainer) ?? null;
}

/** Get already awarded months for a client. */
export function getAwardedMonths(clientId) {
  const list = safeParse([]);
  return list.filter((r) => r.clientId === clientId).map((r) => r.months);
}

/** Record that we showed the loyalty award for this client at this month. */
export function recordLoyaltyAward(clientId, months, stats = {}) {
  const list = safeParse([]);
  const existing = list.find((r) => r.clientId === clientId && r.months === months);
  if (existing) return existing;
  const record = {
    id: nextId(),
    clientId,
    months,
    stats,
    created_date: new Date().toISOString(),
  };
  list.push(record);
  safeSet(list);
  return record;
}

/** Check if we should show the loyalty modal (client just crossed 1, 3, 6, or 12 months and not yet shown). */
export function shouldShowLoyaltyModal(clientId, createdAt) {
  const months = getMonthsWithTrainer(createdAt);
  const awarded = getAwardedMonths(clientId);
  const milestone = MONTHS_MILESTONES.find((m) => m <= months && !awarded.includes(m));
  return milestone != null ? { months: milestone, totalMonths: months } : null;
}
