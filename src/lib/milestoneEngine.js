/**
 * Milestone engine: evaluates check-ins / measurements and unlocks achievements.
 * Uses evaluateMilestones (time, weight, strength, adherence) and legacy weight/streak.
 */
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { isUnlocked, unlockMilestone, MILESTONE_DEFS } from './milestonesStore';
import { evaluateMilestones } from './milestoneEvaluation';

const WEIGHT_MILESTONES_KG = [2.5, 5, 10];
const STREAK_MILESTONES_DAYS = [7, 14, 30];

function getWeightDeltaKg(checkInsWithWeight) {
  if (!checkInsWithWeight.length) return null;
  const sorted = [...checkInsWithWeight].sort(
    (a, b) => new Date(a.submitted_at || a.created_date) - new Date(b.submitted_at || b.created_date)
  );
  const baseline = sorted[0].weight_kg;
  const latest = sorted[sorted.length - 1].weight_kg;
  return latest != null && baseline != null ? latest - baseline : null;
}

function getConsecutiveStreakDays(checkIns) {
  const submitted = checkIns.filter((c) => c.status === 'submitted' && (c.submitted_at || c.created_date));
  if (!submitted.length) return 0;
  const dates = [...new Set(submitted.map((c) => (c.submitted_at || c.created_date).slice(0, 10)))].sort();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = dates.length - 1; i >= 0; i--) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - (dates.length - 1 - i));
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dates[i] === expectedStr) streak++;
    else break;
  }
  return streak;
}

/** Run for a client: evaluateMilestones + legacy weight/streak. Returns first newly unlocked record or null. */
export function evaluateClientMilestones(clientId, options = {}) {
  const client = getClientById(clientId);
  const checkIns = getClientCheckIns(clientId);
  const lifts = options.lifts || [];

  const { newMilestones } = evaluateMilestones(client, checkIns, lifts);
  for (const m of newMilestones) {
    const record = unlockMilestone(m.milestoneId, {
      clientId,
      type: m.type,
      statImprovement: m.statImprovement,
      title: m.title,
      description: m.description,
    });
    if (record) return record;
  }

  const withWeight = checkIns.filter((c) => c.weight_kg != null && (c.submitted_at || c.created_date));
  const delta = getWeightDeltaKg(withWeight);
  const streakDays = getConsecutiveStreakDays(checkIns);

  if (delta != null) {
    const absDelta = Math.abs(delta);
    for (const kg of WEIGHT_MILESTONES_KG) {
      if (absDelta >= kg) {
        const milestoneId = kg === 2.5 ? 'weight_2_5' : kg === 5 ? 'weight_5' : 'weight_10';
        if (!isUnlocked(clientId, milestoneId, { byUser: false })) {
          const record = unlockMilestone(milestoneId, { clientId });
          if (record) return record;
        }
      }
    }
  }

  for (const days of STREAK_MILESTONES_DAYS) {
    if (streakDays >= days) {
      const milestoneId = days === 7 ? 'streak_7' : days === 14 ? 'streak_14' : 'streak_30';
      if (!isUnlocked(clientId, milestoneId, { byUser: false })) {
        const record = unlockMilestone(milestoneId, { clientId });
        if (record) return record;
      }
    }
  }

  return null;
}

/** Run for a user (client/solo) by their userId: use clientId = userId for solo/client self-view. */
export function evaluateUserMilestones(userId, checkIns) {
  const withWeight = (checkIns || []).filter((c) => c.weight_kg != null && (c.submitted_at || c.created_date));
  const delta = getWeightDeltaKg(withWeight);
  const streakDays = getConsecutiveStreakDays(checkIns || []);

  let unlocked = null;

  if (delta != null) {
    const absDelta = Math.abs(delta);
    for (const kg of WEIGHT_MILESTONES_KG) {
      if (absDelta >= kg) {
        const milestoneId = kg === 2.5 ? 'weight_2_5' : kg === 5 ? 'weight_5' : 'weight_10';
        if (!isUnlocked(userId, milestoneId, { byUser: true })) {
          unlocked = unlockMilestone(milestoneId, { userId });
          if (unlocked) break;
        }
      }
    }
  }

  if (!unlocked) {
    for (const days of STREAK_MILESTONES_DAYS) {
      if (streakDays >= days) {
        const milestoneId = days === 7 ? 'streak_7' : days === 14 ? 'streak_14' : 'streak_30';
        if (!isUnlocked(userId, milestoneId, { byUser: true })) {
          unlocked = unlockMilestone(milestoneId, { userId });
          if (unlocked) break;
        }
      }
    }
  }

  return unlocked;
}

export { MILESTONE_DEFS };
