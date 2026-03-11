/**
 * Milestone evaluation: time, weight, strength, adherence.
 * Returns only milestones that are newly crossed and not yet unlocked (once per threshold).
 */
import { normalizePhase } from '@/lib/intelligence/clientRisk';
import { isUnlocked } from './milestonesStore';

const TIME_WEEKS = [4, 12, 24, 52];
const ADHERENCE_STREAK_WEEKS = 8;
const ADHERENCE_MIN_PCT = 80;
const WEIGHT_PHASE_KG = 5;
const STRENGTH_MINOR_KG = 2.5;
const STRENGTH_MAJOR_KG = 5;
const STRENGTH_ELITE_KG = 10;

/** Weeks with coach from client.created_date or phaseStartedAt. */
function getWeeksWithCoach(client) {
  const start = client?.phaseStartedAt || client?.created_date;
  if (!start) return 0;
  const ms = Date.now() - new Date(start).getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

/** Weight delta from baseline (first submitted weight or client.baselineWeight). */
function getWeightDelta(client, checkins) {
  const submitted = checkins
    .filter((c) => c.status === 'submitted' && c.weight_kg != null && (c.submitted_at || c.created_date))
    .sort((a, b) => new Date(a.submitted_at || a.created_date) - new Date(b.submitted_at || b.created_date));
  if (!submitted.length) return null;
  const baseline = client?.baselineWeight ?? submitted[0].weight_kg;
  const latest = submitted[submitted.length - 1].weight_kg;
  return { delta: latest - baseline, baseline, latest };
}

/** Per-lift best improvement from baseline (client.baselineStrength) to latest in lifts or checkin metrics. */
function getLiftImprovements(client, checkins, lifts) {
  const baseline = client?.baselineStrength && typeof client.baselineStrength === 'object' ? client.baselineStrength : {};
  const keyLifts = Object.keys(baseline).filter((k) => typeof baseline[k] === 'number');
  if (!keyLifts.length) return [];

  const byLift = {};
  (lifts || []).forEach((e) => {
    const k = e.liftKey || e.lift;
    if (!k || (e.value == null && e.valueKg == null)) return;
    const v = e.value ?? e.valueKg;
    if (!byLift[k]) byLift[k] = [];
    byLift[k].push({ date: e.date || e.created_date, value: v });
  });
  checkins
    .filter((c) => c.status === 'submitted' && c.metrics && typeof c.metrics === 'object')
    .forEach((c) => {
      const date = c.submitted_at || c.created_date;
      Object.entries(c.metrics).forEach(([k, v]) => {
        if (typeof v !== 'number') return;
        if (!byLift[k]) byLift[k] = [];
        byLift[k].push({ date, value: v });
      });
    });

  const result = [];
  keyLifts.forEach((liftKey) => {
    const base = baseline[liftKey];
    const list = (byLift[liftKey] || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = list[0]?.value;
    if (latest == null || base == null) return;
    const increase = latest - base;
    if (increase > 0) result.push({ liftKey, baseline: base, latest, increaseKg: increase });
  });
  return result;
}

/** Weekly adherence: week key (e.g. 2025-W05) -> avg adherence_pct for that week. */
function getWeeklyAdherence(checkins) {
  const submitted = checkins.filter((c) => c.status === 'submitted' && (c.submitted_at || c.created_date) && c.adherence_pct != null);
  if (!submitted.length) return [];
  const byWeek = {};
  submitted.forEach((c) => {
    const d = new Date(c.submitted_at || c.created_date);
    const weekNum = getWeekNumber(d);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(c.adherence_pct);
  });
  return Object.entries(byWeek)
    .map(([week, pcts]) => ({ week, avg: pcts.reduce((s, p) => s + p, 0) / pcts.length }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

/** Whether there are 8 consecutive weeks with avg adherence >= 80%. */
function has8WeekAdherenceStreak(weeklyAdherence) {
  if (weeklyAdherence.length < ADHERENCE_STREAK_WEEKS) return false;
  for (let i = 0; i <= weeklyAdherence.length - ADHERENCE_STREAK_WEEKS; i++) {
    const slice = weeklyAdherence.slice(i, i + ADHERENCE_STREAK_WEEKS);
    if (slice.every((w) => w.avg >= ADHERENCE_MIN_PCT)) return true;
  }
  return false;
}

/**
 * Evaluate milestones. Returns only those that are crossed and not yet unlocked.
 * @param {Object} client - { id, phase, created_date?, phaseStartedAt?, baselineWeight?, baselineStrength? }
 * @param {Array} checkins - Client check-ins
 * @param {Array} lifts - Optional lift entries { date, liftKey, value } or { liftKey, valueKg }
 * @returns {{ newMilestones: Array<{ type: string, milestoneId: string, title: string, description: string, statImprovement: string }> }}
 */
export function evaluateMilestones(client, checkins, lifts = []) {
  const clientId = client?.id;
  if (!clientId) return { newMilestones: [] };

  const newMilestones = [];
  const phase = normalizePhase(client?.phase);

  // Time: 4, 12, 24, 52 weeks
  const weeksWithCoach = getWeeksWithCoach(client);
  for (const w of TIME_WEEKS) {
    if (weeksWithCoach < w) continue;
    const milestoneId = `time_${w}`;
    if (isUnlocked(clientId, milestoneId, { byUser: false })) continue;
    newMilestones.push({
      type: 'time',
      milestoneId,
      title: `${w} weeks with coach`,
      description: `You've been with your coach for ${w} weeks.`,
      statImprovement: `${w} weeks`,
    });
  }

  // Weight: bulk +5kg, cut -5kg
  const weightDelta = getWeightDelta(client, checkins || []);
  if (weightDelta != null) {
    if (phase === 'bulk' && weightDelta.delta >= WEIGHT_PHASE_KG) {
      const milestoneId = 'weight_bulk_5';
      if (!isUnlocked(clientId, milestoneId, { byUser: false })) {
        newMilestones.push({
          type: 'weight',
          milestoneId,
          title: 'Bulk: +5 kg',
          description: 'You gained 5 kg during your bulk phase.',
          statImprovement: `+${weightDelta.delta.toFixed(1)} kg`,
        });
      }
    } else if (phase === 'cut' && weightDelta.delta <= -WEIGHT_PHASE_KG) {
      const milestoneId = 'weight_cut_5';
      if (!isUnlocked(clientId, milestoneId, { byUser: false })) {
        newMilestones.push({
          type: 'weight',
          milestoneId,
          title: 'Cut: -5 kg',
          description: 'You lost 5 kg during your cut phase.',
          statImprovement: `${weightDelta.delta.toFixed(1)} kg`,
        });
      }
    }
  }

  // Strength: per-lift 2.5 / 5 / 10 kg PR
  const liftImprovements = getLiftImprovements(client, checkins || [], lifts);
  const strengthTiers = [
    { kg: STRENGTH_ELITE_KG, suffix: 'elite', label: 'Elite PR' },
    { kg: STRENGTH_MAJOR_KG, suffix: 'major', label: 'Major PR' },
    { kg: STRENGTH_MINOR_KG, suffix: 'minor', label: 'Minor PR' },
  ];
  liftImprovements.forEach(({ liftKey, increaseKg }) => {
    for (const tier of strengthTiers) {
      if (increaseKg < tier.kg) continue;
      const milestoneId = `strength_${liftKey}_${tier.suffix}`;
      if (isUnlocked(clientId, milestoneId, { byUser: false })) continue;
      newMilestones.push({
        type: 'strength',
        milestoneId,
        title: `${liftKey} ${tier.label}`,
        description: `${liftKey} increased by ${tier.kg}+ kg (${increaseKg.toFixed(1)} kg).`,
        statImprovement: `+${increaseKg.toFixed(1)} kg ${liftKey}`,
      });
      break;
    }
  });

  // Adherence: 8 week streak > 80%
  const weeklyAdherence = getWeeklyAdherence(checkins || []);
  if (has8WeekAdherenceStreak(weeklyAdherence)) {
    const milestoneId = 'adherence_8_80';
    if (!isUnlocked(clientId, milestoneId, { byUser: false })) {
      newMilestones.push({
        type: 'adherence',
        milestoneId,
        title: '8-week adherence streak',
        description: '8 consecutive weeks with 80%+ adherence.',
        statImprovement: '8 weeks > 80%',
      });
    }
  }

  return { newMilestones };
}
