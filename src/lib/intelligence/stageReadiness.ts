/**
 * Stage Readiness Score for competition prep clients.
 * Score based on: adherence, weight trend vs goal, conditioning trend,
 * check-in consistency, peak week data (if in peak_week phase).
 * Returns: { score, flags[], suggestions[] }
 */

export interface StageReadinessResult {
  score: number;
  flags: string[];
  suggestions: string[];
}

interface CheckinLike {
  weight_kg?: number | null;
  weight_avg?: number | null;
  adherence_pct?: number | null;
  submitted_at?: string | null;
  created_at?: string | null;
  created_date?: string | null;
}

interface ClientLike {
  showDate?: string | null;
  prepPhase?: string | null;
  baselineWeight?: number | null;
  baseline_weight?: number | null;
  target_weight?: number | null;
}

function getSubmittedCheckins(checkins: CheckinLike[]): CheckinLike[] {
  return checkins
    .filter((c) => c.submitted_at || c.created_at || c.created_date)
    .sort(
      (a, b) =>
        new Date(b.submitted_at || b.created_at || b.created_date!).getTime() -
        new Date(a.submitted_at || a.created_at || a.created_date!).getTime()
    );
}

function adherenceAvg(checkins: CheckinLike[]): number | null {
  const withPct = checkins.filter((c) => c.adherence_pct != null);
  if (!withPct.length) return null;
  const sum = withPct.reduce((s, c) => s + (c.adherence_pct ?? 0), 0);
  return sum / withPct.length;
}

function weightTrendLastTwo(checkins: CheckinLike[]): { current: number; previous: number; trendKg: number } | null {
  const withWeight = checkins
    .filter((c) => c.weight_kg != null || c.weight_avg != null)
    .map((c) => ({ weight: c.weight_kg ?? c.weight_avg!, at: c.submitted_at || c.created_at || c.created_date! }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (withWeight.length < 2) return null;
  return {
    current: withWeight[0].weight,
    previous: withWeight[1].weight,
    trendKg: withWeight[0].weight - withWeight[1].weight,
  };
}

/**
 * Compute stage readiness score (0–100), flags, and suggestions.
 */
export function computeStageReadiness(
  client: ClientLike,
  checkins: CheckinLike[]
): StageReadinessResult {
  const flags: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  const submitted = getSubmittedCheckins(checkins);
  const phase = (client.prepPhase ?? '').toLowerCase();
  const isPeakWeek = phase === 'peak_week' || phase === 'show_day';

  // Check-in consistency: at least 1 in last 14 days
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentCheckins = submitted.filter(
    (c) => new Date(c.submitted_at || c.created_at || c.created_date!).getTime() >= twoWeeksAgo
  );
  if (submitted.length === 0) {
    flags.push('No check-ins submitted');
    suggestions.push('Encourage regular check-ins to track readiness.');
    score -= 30;
  } else if (recentCheckins.length === 0) {
    flags.push('No check-in in the last 2 weeks');
    suggestions.push('Schedule a check-in this week.');
    score -= 20;
  }

  // Adherence
  const adherence = adherenceAvg(submitted);
  if (adherence != null) {
    if (adherence < 70) {
      flags.push(`Low adherence (${Math.round(adherence)}%)`);
      suggestions.push('Review nutrition and training adherence; address barriers.');
      score -= 25;
    } else if (adherence < 85) {
      flags.push(`Moderate adherence (${Math.round(adherence)}%)`);
      suggestions.push('Aim for 85%+ adherence for best stage readiness.');
      score -= 10;
    }
  }

  // Weight trend vs goal (simplified: we don't have explicit "goal weight", use baseline or show context)
  const targetWeight = client.target_weight ?? client.baselineWeight ?? client.baseline_weight;
  const trend = weightTrendLastTwo(submitted);
  if (trend != null && targetWeight != null && typeof targetWeight === 'number') {
    const current = trend.current;
    const diffFromTarget = current - targetWeight;
    if (phase === 'prep' || phase === 'peak_week') {
      if (diffFromTarget > 1.5) {
        flags.push(`Weight above target by ${diffFromTarget.toFixed(1)} kg`);
        suggestions.push('Consider adjusting nutrition to stay on track for show date.');
        score -= 15;
      }
    }
  }

  // Peak week: suggest having peak week data (we don't have a separate peak_week metric; just note it)
  if (isPeakWeek) {
    if (recentCheckins.length === 0) {
      flags.push('Peak week: no recent check-in');
      suggestions.push('Log peak week metrics (weight, water, etc.) for reference.');
    }
  }

  // Show date countdown: if show is soon and score is low, flag
  const showDate = client.showDate;
  if (showDate) {
    const daysToShow = Math.ceil((new Date(showDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysToShow < 0) {
      flags.push('Show date has passed');
    } else if (daysToShow <= 7 && score < 80) {
      suggestions.push('Show is within 7 days; focus on execution and recovery.');
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return { score: finalScore, flags, suggestions };
}
