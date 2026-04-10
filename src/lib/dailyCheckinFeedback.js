/**
 * Copy for daily check-in: live “today looks like” lines + post-submit adjustment summary.
 */

/** @param {number} n 1–5 */
function bandWord(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 1) return '';
  if (x <= 2) return 'Low';
  if (x === 3) return 'Moderate';
  return 'High';
}

/** @param {number} n 1–5 */
function sleepQualityPhrase(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 1) return '';
  if (x <= 2) return 'Poor sleep quality';
  if (x === 3) return 'Moderate sleep quality';
  return 'Great sleep quality';
}

/**
 * Bullet lines for “Today looks like” (partial OK as user fills in).
 * @param {{ energy?: number, recovery?: number, sleepQuality?: number, stress?: number, appetite?: number }} v
 * @returns {string[]}
 */
export function buildTodayLooksLikeLines(v = {}) {
  const out = [];
  if (v.energy) out.push(`${bandWord(v.energy)} energy`);
  if (v.recovery) out.push(`${bandWord(v.recovery)} recovery`);
  if (v.sleepQuality) out.push(sleepQualityPhrase(v.sleepQuality));
  if (v.stress) out.push(`${bandWord(v.stress)} stress`);
  if (v.appetite) out.push(`${bandWord(v.appetite)} appetite`);
  return out;
}

/**
 * Reflect inputs in the reason line.
 * @param {{ energy?: number, recovery?: number, sleepQuality?: number, stress?: number, appetite?: number }} v
 */
export function buildInputReasonFragment(v = {}) {
  const parts = buildTodayLooksLikeLines(v).map((s) => s.toLowerCase());
  if (!parts.length) return '';
  return `Based on your check-in (${parts.slice(0, 4).join(', ')}${parts.length > 4 ? '…' : ''}).`;
}

/**
 * Post-submit “Today’s Adjustment” for personal feedback loop.
 * @param {{ decision?: { type?: string, reason?: string }, programAdjustment?: { summary?: string } } | null} loop
 */
export function buildPersonalTodaysAdjustment(loop) {
  const t = String(loop?.decision?.type || 'on_track');
  const baseReason = loop?.decision?.reason || '';

  if (t === 'reduce_volume') {
    return {
      volume: 'Slightly reduced (about 1 fewer working set per exercise)',
      intensity: 'Kept the same target effort (RIR)',
      rest: 'A bit more rest between sets to protect recovery',
      reason: baseReason || 'Fatigue and recovery signals suggest easing volume today.',
    };
  }
  if (t === 'adjust_plan') {
    return {
      volume: 'Slightly increased (about 1 more working set where appropriate)',
      intensity: 'Kept the same target effort (RIR)',
      rest: 'Slightly shorter rest to match the progression push',
      reason:
        `${baseReason || 'Progress signals support a small bump in training stress.'}`.trim(),
    };
  }
  if (t === 'flag_adherence') {
    return {
      volume: 'No automatic change',
      intensity: 'No automatic change',
      rest: 'No automatic change',
      reason:
        `${baseReason || 'Consistency is below target — we are holding load steady until habits rebound.'}`.trim(),
    };
  }
  return {
    volume: 'No change — follow your programmed session',
    intensity: 'No change — same RIR / effort targets',
    rest: 'No change — same rest periods',
    reason: baseReason || 'Your signals look balanced; next session stays as written.',
  };
}

/**
 * Merge input-based reason into personal adjustment (call after you have values).
 */
export function withInputReasonFragment(adjustment, v) {
  const frag = buildInputReasonFragment(v);
  if (!frag) return adjustment;
  const base = String(adjustment?.reason || '').trim();
  return {
    ...adjustment,
    reason: base ? `${base} ${frag}`.replace(/\s+/g, ' ').trim() : frag,
  };
}

/**
 * Post-submit lines for coached clients (adaptive recommendation).
 * @param {Record<string, unknown> | null | undefined} recommendation
 */
export function buildClientTodaysAdjustment(recommendation) {
  const type = String(recommendation?.recommendation_type || 'keep_as_is');
  const desc = String(recommendation?.description || '').trim();
  const title = String(recommendation?.title || '').trim();

  if (type === 'reduce_volume') {
    return {
      volume: 'Bias toward fewer working sets today',
      intensity: 'Keep effort controlled (same RIR intent)',
      rest: 'Slightly more rest if sets feel heavy',
      reason: desc || title || 'Readiness suggests dialing volume back slightly.',
    };
  }
  if (type === 'reduce_intensity') {
    return {
      volume: 'Same structure — reps/sets as planned',
      intensity: 'Ease target intensity (+1 RIR / leave more in the tank)',
      rest: 'Use rest as needed to stay smooth',
      reason: desc || title || 'Readiness suggests easing intensity while keeping volume.',
    };
  }
  if (type === 'recovery_session') {
    return {
      volume: 'Recovery-style session',
      intensity: 'Easy–moderate effort',
      rest: 'Generous rest — move well, don’t grind',
      reason: desc || title || 'Today is a recovery bias until signals improve.',
    };
  }
  if (type === 'deload_recommendation') {
    return {
      volume: 'Deload-style week (lighter overall load)',
      intensity: 'Reduced strain — technique and freshness first',
      rest: 'Standard or slightly longer as needed',
      reason: desc || title || 'Repeated low readiness — time to back off systematically.',
    };
  }
  return {
    volume: 'As programmed by your coach',
    intensity: 'As programmed by your coach',
    rest: 'As programmed by your coach',
    reason: desc || title || 'No automatic change from this check-in — you are clear to train as planned.',
  };
}
