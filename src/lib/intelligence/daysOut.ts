/**
 * Days until show (comp prep). Used for health sensitivity, at-risk severity, review priority.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Integer days until showDate. Past dates return negative; invalid/missing returns null.
 */
export function getDaysOut(showDateISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!showDateISO || typeof showDateISO !== 'string') return null;
  const show = new Date(showDateISO);
  if (Number.isNaN(show.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  show.setHours(0, 0, 0, 0);
  const diff = Math.ceil((show.getTime() - today.getTime()) / MS_PER_DAY);
  return diff;
}
