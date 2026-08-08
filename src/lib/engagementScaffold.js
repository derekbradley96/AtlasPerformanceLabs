/**
 * Week ~4–6 motivation scaffolding for transformation clients (research-backed dip window).
 */
import { formatWeightDeltaKg } from '@/lib/bodyMeasurementUnits';

/** @param {{ created_at?: string | null }} client */
export function shouldShowMotivationBoost(client) {
  if (!client?.created_at) return false;
  const joinDate = new Date(client.created_at);
  if (Number.isNaN(joinDate.getTime())) return false;
  const daysIn = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysIn >= 25 && daysIn <= 50;
}

/**
 * @param {string | null | undefined} clientName
 * @param {number|string|null|undefined} startWeight
 * @param {number|string|null|undefined} currentWeight
 * @param {string | null | undefined} firstWorkoutDate
 * @param {number} workoutsCompleted
 * @param {unknown} firstProgressPhoto
 * @param {'kg'|'lb'|'st_lb'} [viewerWeightUnit] viewer display unit (weights stay canonical kg)
 */
export function buildMotivationBoostContent(
  clientName,
  startWeight,
  currentWeight,
  firstWorkoutDate,
  workoutsCompleted,
  firstProgressPhoto,
  viewerWeightUnit = 'kg',
) {
  const firstName = clientName?.split(' ')[0] || clientName || 'there';
  const sw = Number(startWeight);
  const cw = Number(currentWeight);
  const delta = Number.isFinite(sw) && Number.isFinite(cw) ? cw - sw : 0;

  return {
    headline: `${firstName}, look how far you've come`,
    stat1: {
      label: 'Weight change',
      value: formatWeightDeltaKg(delta, viewerWeightUnit),
      context: 'since you started',
    },
    stat2: {
      label: 'Workouts completed',
      value: workoutsCompleted,
      context: 'sessions logged with Atlas',
    },
    meta: { firstWorkoutDate, firstProgressPhoto },
    message:
      "Week 4–6 is when most people start to doubt themselves. The results feel slower than the start, motivation dips, and it gets harder to stay consistent. This is completely normal — and it's also exactly when the foundation you've been building starts to pay off. Keep going.",
    cta: 'View your progress photos',
  };
}
