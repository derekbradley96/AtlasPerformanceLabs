import { generateQuickStartWeek, suggestSplitType } from '@/lib/workoutQuickStart';

/**
 * Template splits for personal onboarding / quick create:
 * 2d → upper/lower, 3d → PPL, 4d → upper/lower (4-day preset inside generator).
 */
export function personalTemplateSplitType(daysPerWeek) {
  const d = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
  if (d === 2) return 'upper_lower';
  if (d === 3) return 'push_pull_legs';
  if (d === 4) return 'upper_lower';
  return suggestSplitType(d);
}

export function buildPersonalQuickStartWeek(daysPerWeek, goal = 'muscle') {
  const splitType = personalTemplateSplitType(daysPerWeek);
  return generateQuickStartWeek({
    goal,
    daysPerWeek,
    splitType,
  });
}
