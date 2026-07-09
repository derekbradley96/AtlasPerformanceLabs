/**
 * Weekly "Am I doing enough?" score for personal transformation (0–99).
 */

export function calculateWeeklyScore({
  workoutsCompleted,
  workoutsPlanned,
  nutritionDaysHit,
  totalDays,
  // Recovery = real daily check-in adherence this week. Atlas doesn't track
  // sleep hours or steps for personal users, so basing recovery on those was
  // fabricated (it pinned recovery near max for everyone). Daily check-ins are
  // the recovery signal we actually collect.
  recoveryDaysLogged,
  recoveryDaysTarget,
}) {
  const trainingScore =
    workoutsPlanned > 0
      ? Math.round((workoutsCompleted / workoutsPlanned) * 33)
      : workoutsCompleted > 0
        ? 25
        : 0;

  const nutritionScore =
    totalDays > 0 ? Math.round((nutritionDaysHit / totalDays) * 33) : 0;

  const recTarget = Number(recoveryDaysTarget) || 0;
  const recoveryScore =
    recTarget > 0
      ? Math.round(Math.min(1, Number(recoveryDaysLogged || 0) / recTarget) * 33)
      : 0;

  const total = Math.min(99, trainingScore + nutritionScore + recoveryScore);

  const grade =
    total >= 90
      ? 'Excellent'
      : total >= 75
        ? 'Good'
        : total >= 60
          ? 'Solid'
          : total >= 40
            ? 'Room to improve'
            : 'Tough week';

  const focusArea =
    nutritionScore < trainingScore && nutritionScore < recoveryScore
      ? {
          area: 'Nutrition',
          tip: `Hit your macros ${Math.max(0, (totalDays || 7) - (nutritionDaysHit || 0))} more days next week`,
        }
      : trainingScore < 25
        ? {
            area: 'Training',
            tip: `Aim for ${workoutsPlanned || 3} sessions next week`,
          }
        : { area: 'Recovery', tip: 'Log a daily check-in to track recovery' };

  return {
    total,
    grade,
    trainingScore,
    nutritionScore,
    recoveryScore,
    focusArea,
    trainingBar10: Math.min(10, Math.round((trainingScore / 33) * 10)),
    nutritionBar10: Math.min(10, Math.round((nutritionScore / 33) * 10)),
    recoveryBar10: Math.min(10, Math.round((recoveryScore / 33) * 10)),
  };
}

/** ISO week key e.g. 2026-W17 */
export function getIsoWeekKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  const t = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function weeklyScoreDismissStorageKey(userId, weekKey) {
  return `atlas-weekly-score-dismissed-${userId || 'anon'}-${weekKey}`;
}
