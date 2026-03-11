/**
 * Gamification milestones (achievements). localStorage-backed.
 * Used by client/solo for their own achievements; trainer sees client achievements in Client Detail.
 */
const KEY = 'atlas_milestones';

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

/** Milestone definitions: id, title, description, category (weight | streak | loyalty | time | strength | adherence) */
export const MILESTONE_DEFS = [
  { id: 'weight_2_5', title: 'Weight shift ±2.5 kg', description: 'You changed your weight by 2.5 kg from baseline.', category: 'weight' },
  { id: 'weight_5', title: 'Weight shift ±5 kg', description: 'You changed your weight by 5 kg from baseline.', category: 'weight' },
  { id: 'weight_10', title: 'Weight shift ±10 kg', description: 'You changed your weight by 10 kg from baseline.', category: 'weight' },
  { id: 'weight_bulk_5', title: 'Bulk: +5 kg', description: 'You gained 5 kg during your bulk phase.', category: 'weight' },
  { id: 'weight_cut_5', title: 'Cut: -5 kg', description: 'You lost 5 kg during your cut phase.', category: 'weight' },
  { id: 'streak_7', title: '7-day streak', description: '7 days in a row of check-ins completed.', category: 'streak' },
  { id: 'streak_14', title: '14-day streak', description: '14 days in a row of check-ins completed.', category: 'streak' },
  { id: 'streak_30', title: '30-day streak', description: '30 days in a row of check-ins completed.', category: 'streak' },
  { id: 'loyalty_1', title: '30 days with coach', description: "You've been with your coach for 30 days.", category: 'loyalty' },
  { id: 'loyalty_2', title: '60 days with coach', description: "You've been with your coach for 60 days.", category: 'loyalty' },
  { id: 'loyalty_3', title: '90 days with coach', description: "You've been with your coach for 90 days.", category: 'loyalty' },
  { id: 'loyalty_6', title: '180 days with coach', description: "You've been with your coach for 180 days.", category: 'loyalty' },
  { id: 'loyalty_12', title: '12 months with coach', description: "You've been with your coach for 12 months.", category: 'loyalty' },
  { id: 'time_4', title: '4 weeks with coach', description: "You've been with your coach for 4 weeks.", category: 'time' },
  { id: 'time_12', title: '12 weeks with coach', description: "You've been with your coach for 12 weeks.", category: 'time' },
  { id: 'time_24', title: '24 weeks with coach', description: "You've been with your coach for 24 weeks.", category: 'time' },
  { id: 'time_52', title: '52 weeks with coach', description: "You've been with your coach for a year.", category: 'time' },
  { id: 'adherence_8_80', title: '8-week adherence streak', description: '8 consecutive weeks with 80%+ adherence.', category: 'adherence' },
];

/** Resolve category for dynamic strength milestone ids (e.g. strength_squat_minor). */
export function getMilestoneCategory(milestoneId) {
  const def = MILESTONE_DEFS.find((d) => d.id === milestoneId);
  if (def) return def.category;
  if (milestoneId && milestoneId.startsWith('strength_')) return 'strength';
  return 'streak';
}

function nextId() {
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Get all unlocked records: { id, userId?, clientId?, milestoneId, unlockedAt } */
export function getUnlockedMilestones(userIdOrClientId, options = {}) {
  const list = safeParse([]);
  const byUser = options.byUser === true;
  return list.filter((r) =>
    byUser ? r.userId === userIdOrClientId : r.clientId === userIdOrClientId
  );
}

/** Get all achievements for a user (client/solo) or for a client (trainer view). */
export function getAchievementsList(userIdOrClientId, options = {}) {
  const unlocked = getUnlockedMilestones(userIdOrClientId, options);
  return unlocked
    .map((r) => {
      const def = MILESTONE_DEFS.find((d) => d.id === r.milestoneId);
      const category = def?.category ?? r.type ?? getMilestoneCategory(r.milestoneId);
      return {
        ...r,
        title: def?.title ?? r.title ?? r.milestoneId,
        description: def?.description ?? r.description ?? '',
        category,
      };
    })
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt));
}

/** Check if a specific milestone is already unlocked for this user/client. */
export function isUnlocked(userIdOrClientId, milestoneId, options = {}) {
  return getUnlockedMilestones(userIdOrClientId, options).some((r) => r.milestoneId === milestoneId);
}

/** Unlock a milestone. Returns the new record if newly unlocked, null if already had it. Optional meta: { type, statImprovement, title, description }. */
export function unlockMilestone(milestoneId, { userId, clientId, type, statImprovement, title, description } = {}) {
  const list = safeParse([]);
  const key = userId || clientId;
  if (!key) return null;
  const existing = list.find(
    (r) => r.milestoneId === milestoneId && (r.userId === key || r.clientId === key)
  );
  if (existing) return null;
  const record = {
    id: nextId(),
    userId: userId || undefined,
    clientId: clientId || undefined,
    milestoneId,
    unlockedAt: new Date().toISOString(),
    ...(type != null && { type }),
    ...(statImprovement != null && { statImprovement }),
    ...(title != null && { title }),
    ...(description != null && { description }),
  };
  list.push(record);
  safeSet(list);
  return record;
}

/** Mark that we've shown the "Achievement unlocked" modal for this record (so we don't show again). */
const SHOWN_KEY = 'atlas_milestones_shown';
export function getShownAchievementIds() {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
export function markAchievementShown(recordId) {
  try {
    const ids = getShownAchievementIds();
    if (!ids.includes(recordId)) ids.push(recordId);
    localStorage.setItem(SHOWN_KEY, JSON.stringify(ids));
  } catch (e) {}
}
