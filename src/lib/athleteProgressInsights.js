/**
 * Athlete-facing progress insights: short, actionable phrases from metrics and momentum.
 * Used by Athlete Dashboard, DailyCompletionCard, or any client view.
 *
 * Examples: "Weight trending down", "Steps improving", "Training consistency high"
 *
 * @param {Object} [metrics] - v_client_progress_metrics row: weight_change, latest_weight, previous_weight, avg_compliance_last_4w, latest_steps_avg
 * @param {Object} [momentum] - v_client_momentum row (current week): training_score, steps_score, nutrition_score, total_score
 * @param {Array<{ weight?: number, steps_avg?: number, submitted_at?: string }>} [trends] - v_client_progress_trends (recent first) for trend comparison
 * @returns {{ insights: Array<{ id: string, text: string, level: 'positive' | 'info' | 'warning' }> }}
 */
export function getAthleteProgressInsights(metrics = {}, momentum = {}, trends = []) {
  const insights = [];
  const seen = new Set();

  function add(id, text, level = 'info') {
    if (seen.has(id)) return;
    seen.add(id);
    insights.push({ id, text, level });
  }

  const toNum = (v) => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const weightChange = toNum(metrics?.weight_change);
  const latestWeight = toNum(metrics?.latest_weight);
  const previousWeight = toNum(metrics?.previous_weight);
  const avgCompliance = toNum(metrics?.avg_compliance_last_4w);
  const latestSteps = toNum(metrics?.latest_steps_avg);

  const trainingScore = toNum(momentum?.training_score);
  const stepsScore = toNum(momentum?.steps_score);
  const nutritionScore = toNum(momentum?.nutrition_score);

  const trendRows = Array.isArray(trends) ? trends : [];

  // --- Weight ---
  if (weightChange != null) {
    if (weightChange < -0.3) add('weight_down', 'Weight trending down', 'info');
    else if (weightChange > 0.3) add('weight_up', 'Weight trending up', 'info');
    else if (latestWeight != null && previousWeight != null) add('weight_stable', 'Weight holding steady', 'positive');
  } else if (latestWeight != null && previousWeight != null) {
    if (latestWeight < previousWeight - 0.3) add('weight_down', 'Weight trending down', 'info');
    else if (latestWeight > previousWeight + 0.3) add('weight_up', 'Weight trending up', 'info');
  }

  // --- Steps ---
  if (stepsScore != null) {
    if (stepsScore >= 80) add('steps_high', 'Steps on target', 'positive');
    else if (stepsScore >= 60) add('steps_ok', 'Steps improving', 'positive');
    else if (stepsScore < 50) add('steps_low', 'Steps below target', 'warning');
  }
  if (latestSteps != null && latestSteps >= 8000 && !seen.has('steps_high') && !seen.has('steps_ok')) {
    add('steps_high', 'Steps on target', 'positive');
  }
  if (trendRows.length >= 4) {
    const recent = trendRows.slice(0, 2).map((r) => toNum(r.steps_avg)).filter((n) => n != null);
    const older = trendRows.slice(2, 4).map((r) => toNum(r.steps_avg)).filter((n) => n != null);
    if (recent.length >= 1 && older.length >= 1) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      if (recentAvg > olderAvg + 500) add('steps_improving', 'Steps improving', 'positive');
    }
  }

  // --- Training consistency ---
  if (trainingScore != null) {
    if (trainingScore >= 85) add('training_high', 'Training consistency high', 'positive');
    else if (trainingScore >= 70) add('training_good', 'Training consistency good', 'positive');
    else if (trainingScore < 50) add('training_low', 'Training consistency low', 'warning');
  }
  if (avgCompliance != null && !seen.has('training_high') && !seen.has('training_good') && !seen.has('training_low')) {
    if (avgCompliance >= 85) add('training_high', 'Training consistency high', 'positive');
    else if (avgCompliance >= 70) add('training_good', 'Training consistency good', 'positive');
    else if (avgCompliance < 60) add('training_low', 'Training consistency low', 'warning');
  }

  // --- Nutrition ---
  if (nutritionScore != null) {
    if (nutritionScore >= 80) add('nutrition_high', 'Nutrition on track', 'positive');
    else if (nutritionScore < 50) add('nutrition_low', 'Nutrition needs attention', 'warning');
  }

  return { insights };
}
