/**
 * Rate-based conditioning readiness hints for solo prep (not medical body composition).
 */

const STAGE_READY_BF = {
  bikini: { min: 10, max: 14 },
  mens_physique: { min: 6, max: 10 },
  figure: { min: 8, max: 12 },
  classic_physique: { min: 4, max: 7 },
  bodybuilding: { min: 3, max: 5 },
};

function normaliseDivisionKey(division) {
  const d = String(division || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '_')
    .replace(/_+/g, '_');
  if (d === 'mensphysique' || d === 'men_s_physique') return 'mens_physique';
  if (d === 'classic' || d === 'classicphysique') return 'classic_physique';
  return d;
}

export function estimateBodyFat({
  weightKg,
  recentWeightTrend,
  weeksOfPrep,
  startWeight,
  division,
  progressPhotoCount,
}) {
  const totalLoss = Number(startWeight) - Number(weightKg);
  const prepWeeks = Math.max(1, Number(weeksOfPrep) || 1);
  const divKey = normaliseDivisionKey(division);
  const target = STAGE_READY_BF[divKey] || { min: 8, max: 12 };

  const trend = Number(recentWeightTrend);
  const rateAssessment =
    !Number.isFinite(trend) || Math.abs(trend) < 0.2
      ? 'plateau — consider reducing calories or increasing cardio'
      : Math.abs(trend) > 0.8
        ? 'losing very fast — risk of muscle loss, consider a refeed'
        : 'on a healthy deficit';

  const weeksToTarget =
    totalLoss < 5 ? Math.round((5 - Math.max(0, totalLoss)) / 0.5) : 0;

  const photoHint =
    Number(progressPhotoCount) > 0
      ? ''
      : ' More progress photos improve how useful your trend reads week to week.';

  return {
    division: division || null,
    stageReadyRange: `${target.min}–${target.max}%`,
    currentRateAssessment: rateAssessment,
    weeksAtCurrentRate: weeksToTarget,
    recommendation:
      weeksToTarget > 8
        ? `At your current rate, you have approximately ${weeksToTarget} weeks of cutting ahead. This is ${
            weeksToTarget > 12 ? 'longer than typical prep — review your timeline' : 'within normal prep range'
          }.${photoHint}`
        : `You appear to be in range for your show. Focus on conditioning and posing.${photoHint}`,
    disclaimer: 'This is an estimate based on rate of change, not a body composition measurement.',
  };
}
