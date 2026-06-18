/**
 * Milestone engine: evaluates check-ins / measurements and unlocks achievements.
 * Uses evaluateMilestones (time, weight, strength, adherence) and legacy weight/streak.
 */
import * as sandbox from '@/lib/sandboxStore';
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

function ensureUnlock({ keyId, milestoneId, byUser, type = null, statImprovement = null, title = null, description = null }) {
  if (!keyId || !milestoneId) return null;
  if (isUnlocked(keyId, milestoneId, { byUser })) return null;
  return unlockMilestone(milestoneId, {
    ...(byUser ? { userId: keyId } : { clientId: keyId }),
    ...(type ? { type } : {}),
    ...(statImprovement ? { statImprovement } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  });
}

/** Run for a client: evaluateMilestones + legacy weight/streak. Returns first newly unlocked record or null. */
export function evaluateClientMilestones(clientId, options = {}) {
  const client = options.client ?? sandbox.getClientById(clientId);
  const checkIns = options.checkIns ?? sandbox.listCheckIns(clientId) ?? [];
  const lifts = options.lifts || [];
  const checkinCount = Number(options.checkinCount ?? checkIns.filter((c) => c.status === 'submitted').length) || 0;
  const workoutCount = Math.max(0, Number(options.workoutCount) || 0);
  const poseCheckCount = Math.max(0, Number(options.poseCheckCount) || 0);
  const isCompetitionClient = options.isCompetitionClient === true || ['competition', 'integrated'].includes(String(options.clientType || client?.client_type || '').toLowerCase());
  const currentWeightKg = Number.isFinite(Number(options.currentWeightKg)) ? Number(options.currentWeightKg) : null;
  const showWeightTargetKg = Number.isFinite(Number(options.showWeightTargetKg)) ? Number(options.showWeightTargetKg) : null;
  const peakWeekCompleted = options.peakWeekCompleted === true;

  const firstCheckin = ensureUnlock({ keyId: clientId, milestoneId: 'first_checkin_submitted', byUser: false, type: 'adherence' });
  if (firstCheckin && checkinCount > 0) return firstCheckin;
  const firstWorkout = ensureUnlock({ keyId: clientId, milestoneId: 'first_workout_logged', byUser: false, type: 'strength' });
  if (firstWorkout && workoutCount > 0) return firstWorkout;
  if (isCompetitionClient && poseCheckCount > 0) {
    const firstPose = ensureUnlock({ keyId: clientId, milestoneId: 'first_pose_check_submitted', byUser: false, type: 'adherence' });
    if (firstPose) return firstPose;
  }
  if (isCompetitionClient && showWeightTargetKg != null && currentWeightKg != null && currentWeightKg <= showWeightTargetKg) {
    const targetReached = ensureUnlock({ keyId: clientId, milestoneId: 'show_weight_target_reached', byUser: false, type: 'weight' });
    if (targetReached) return targetReached;
  }
  if (isCompetitionClient && peakWeekCompleted) {
    const peakWeek = ensureUnlock({ keyId: clientId, milestoneId: 'first_peak_week_complete', byUser: false, type: 'time' });
    if (peakWeek) return peakWeek;
  }

  const { newMilestones } = evaluateMilestones(client, checkIns, lifts, options.viewerWeightUnit ?? 'kg');
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
  const opts = arguments[2] || {};
  const withWeight = (checkIns || []).filter((c) => c.weight_kg != null && (c.submitted_at || c.created_date));
  const delta = getWeightDeltaKg(withWeight);
  const streakDays = getConsecutiveStreakDays(checkIns || []);
  const submittedCheckins = (checkIns || []).filter((c) => c.status === 'submitted').length;
  const workoutCount = Math.max(0, Number(opts.workoutCount) || 0);
  const poseCheckCount = Math.max(0, Number(opts.poseCheckCount) || 0);
  const isCompetitionClient = opts.isCompetitionClient === true;
  const currentWeightKg = Number.isFinite(Number(opts.currentWeightKg)) ? Number(opts.currentWeightKg) : null;
  const showWeightTargetKg = Number.isFinite(Number(opts.showWeightTargetKg)) ? Number(opts.showWeightTargetKg) : null;
  const peakWeekCompleted = opts.peakWeekCompleted === true;

  let unlocked = null;

  if (submittedCheckins > 0) {
    unlocked = ensureUnlock({ keyId: userId, milestoneId: 'first_checkin_submitted', byUser: true, type: 'adherence' });
    if (unlocked) return unlocked;
  }
  if (workoutCount > 0) {
    unlocked = ensureUnlock({ keyId: userId, milestoneId: 'first_workout_logged', byUser: true, type: 'strength' });
    if (unlocked) return unlocked;
  }
  if (isCompetitionClient && poseCheckCount > 0) {
    unlocked = ensureUnlock({ keyId: userId, milestoneId: 'first_pose_check_submitted', byUser: true, type: 'adherence' });
    if (unlocked) return unlocked;
  }
  if (isCompetitionClient && showWeightTargetKg != null && currentWeightKg != null && currentWeightKg <= showWeightTargetKg) {
    unlocked = ensureUnlock({ keyId: userId, milestoneId: 'show_weight_target_reached', byUser: true, type: 'weight' });
    if (unlocked) return unlocked;
  }
  if (isCompetitionClient && peakWeekCompleted) {
    unlocked = ensureUnlock({ keyId: userId, milestoneId: 'first_peak_week_complete', byUser: true, type: 'time' });
    if (unlocked) return unlocked;
  }

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

export function buildMilestoneProgress({ checkinCount = 0, streakDays = 0, workoutCount = 0, poseCheckCount = 0, daysWithCoach = 0, isCompetitionClient = false }) {
  const map = {
    first_checkin_submitted: { current: Math.min(1, checkinCount), target: 1, label: `${Math.min(1, checkinCount)}/1 check-ins` },
    first_workout_logged: { current: Math.min(1, workoutCount), target: 1, label: `${Math.min(1, workoutCount)}/1 workouts` },
    first_pose_check_submitted: { current: Math.min(1, poseCheckCount), target: 1, label: `${Math.min(1, poseCheckCount)}/1 pose checks` },
    first_peak_week_complete: { current: isCompetitionClient ? Math.min(1, daysWithCoach >= 7 ? 1 : 0) : 0, target: 1, label: isCompetitionClient ? `${Math.min(1, daysWithCoach >= 7 ? 1 : 0)}/1 peak weeks` : 'Competition clients only' },
    streak_7: { current: Math.min(7, streakDays), target: 7, label: `${Math.min(7, streakDays)}/7 check-ins` },
    loyalty_1: { current: Math.min(30, daysWithCoach), target: 30, label: `${Math.min(30, daysWithCoach)}/30 days` },
  };
  return map;
}

export { MILESTONE_DEFS };
