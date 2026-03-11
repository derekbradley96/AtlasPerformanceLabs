/**
 * Local review adapter: map check-in and posing data to ReviewItem for ReviewEngine.
 */
import { normalizePhase } from '@/lib/intelligence/clientRisk';

const PHASE_EXPECTATIONS = {
  cut: 'In a cut, minor strength drop is expected. Focus on adherence and steps.',
  bulk: 'In a bulk, aim for steady weight gain. Some strength gain is expected.',
  maintenance: 'In maintenance, weight should stay within a small band. Strength can be maintained or improved.',
};

function getSuggestedAction(riskEvaluation) {
  if (!riskEvaluation?.flags) return riskEvaluation?.recommendedAction ?? null;
  const { flags, phase } = riskEvaluation;
  if (flags.weightDropFlag && phase === 'bulk') return 'Increase calories by ~150 kcal and monitor next check-in.';
  if (flags.weightGainFlag && phase === 'cut') return 'Review nutrition adherence; consider adjusting deficit.';
  if (flags.stepsLowFlag) return 'Adjust steps to 9k; discuss barriers with client.';
  if (flags.lowAdherenceFlag) return 'Review adherence barriers and adjust plan if needed.';
  if (flags.strengthDropFlag) return 'Check recovery and volume; no need to change program yet.';
  if (flags.weightVarianceFlag) return 'Review weight trend; consider small calorie tweak.';
  return riskEvaluation?.recommendedAction ?? null;
}

function getSleepLabel(checkIn) {
  if (!checkIn) return '—';
  if (checkIn.flags?.includes('sleep_low')) return 'Low';
  return checkIn.sleep_hours != null ? `${checkIn.sleep_hours}h` : '—';
}

/**
 * Map this-week + last-week check-ins and client/risk to a ReviewItem for ReviewEngine.
 * @param {object} thisWeek - Current check-in (id, client_id, weight_kg, adherence_pct, steps, sleep_hours, notes, submitted_at, created_date, flags)
 * @param {object|null} lastWeek - Previous check-in (same shape)
 * @param {object} client - Client (id, full_name, phase)
 * @param {object|null} risk - From getClientRiskEvaluation: riskReasons, recommendedAction, phase, flags
 * @returns {import('../types').ReviewItem}
 */
export function checkinToReviewItem(thisWeek, lastWeek, client, risk) {
  const tw = thisWeek;
  const lw = lastWeek || null;
  const clientId = client?.id ?? tw?.client_id ?? '';
  const phase = normalizePhase(client?.phase);
  const phaseLabel = phase === 'cut' ? 'Cut' : phase === 'bulk' ? 'Bulk' : 'Maintenance';

  const weightDelta = lw?.weight_kg != null && tw?.weight_kg != null && lw.weight_kg > 0
    ? Math.round(((tw.weight_kg - lw.weight_kg) / lw.weight_kg) * 100)
    : null;
  const adherenceDelta = lw?.adherence_pct != null && tw?.adherence_pct != null ? tw.adherence_pct - lw.adherence_pct : null;
  const stepsDelta = lw?.steps != null && tw?.steps != null && lw.steps > 0
    ? Math.round(((tw.steps - lw.steps) / lw.steps) * 100)
    : null;
  const weightTrend = weightDelta != null && weightDelta !== 0 ? (weightDelta > 0 ? 'up' : 'down') : null;
  const adherenceTrend = adherenceDelta != null && adherenceDelta !== 0 ? (adherenceDelta > 0 ? 'up' : 'down') : null;
  const stepsTrend = stepsDelta != null && stepsDelta !== 0 ? (stepsDelta > 0 ? 'up' : 'down') : null;

  const adherenceWarning = adherenceDelta != null && adherenceDelta < -10 ? `Adherence down ${-adherenceDelta}% from last week` : null;
  const weightNote = weightDelta != null && Math.abs(weightDelta) > 1 ? `Weight ${weightDelta > 0 ? '+' : ''}${weightDelta}% vs last week` : null;
  const warnings = [adherenceWarning, weightNote].filter(Boolean);

  const suggestedAction = getSuggestedAction(risk);

  return {
    id: tw.id,
    clientId,
    type: 'checkin',
    createdAt: tw.submitted_at || tw.created_date,
    status: 'needs_review',
    title: client?.full_name || 'Client',
    left: {
      title: 'This week',
      metrics: [
        { label: 'Weight (avg)', value: tw.weight_kg != null ? `${tw.weight_kg} kg` : null, delta: weightDelta, deltaWarning: weightNote, trend: weightTrend },
        { label: 'Adherence', value: tw.adherence_pct != null ? `${tw.adherence_pct}%` : null, delta: adherenceDelta, deltaWarning: adherenceWarning, trend: adherenceTrend },
        { label: 'Steps', value: tw.steps != null ? tw.steps.toLocaleString() : null, trend: stepsTrend },
        { label: 'Sleep', value: getSleepLabel(tw) },
      ],
      notes: tw.notes,
    },
    right: lw ? {
      title: 'Last week',
      metrics: [
        { label: 'Weight (avg)', value: lw.weight_kg != null ? `${lw.weight_kg} kg` : null },
        { label: 'Adherence', value: lw.adherence_pct != null ? `${lw.adherence_pct}%` : null },
        { label: 'Steps', value: lw.steps != null ? lw.steps.toLocaleString() : null },
        { label: 'Sleep', value: getSleepLabel(lw) },
      ],
      notes: lw.notes,
    } : undefined,
    phaseContext: { label: `Current phase: ${phaseLabel}`, expectation: PHASE_EXPECTATIONS[phase] || PHASE_EXPECTATIONS.maintenance },
    riskReasons: risk?.riskReasons,
    suggestedAction,
    diffRows: lw ? [
      { label: 'Weight', curr: tw.weight_kg, prev: lw.weight_kg, format: (v) => (v != null ? `${v} kg` : '—'), delta: tw.weight_kg != null && lw.weight_kg != null && lw.weight_kg > 0 ? ((tw.weight_kg - lw.weight_kg) / lw.weight_kg) * 100 : null },
      { label: 'Adherence', curr: tw.adherence_pct, prev: lw.adherence_pct, format: (v) => (v != null ? `${v}%` : '—'), delta: tw.adherence_pct != null && lw.adherence_pct != null ? tw.adherence_pct - lw.adherence_pct : null },
      { label: 'Steps', curr: tw.steps, prev: lw.steps, format: (v) => (v != null ? Number(v).toLocaleString() : '—'), delta: tw.steps != null && lw.steps != null && lw.steps > 0 ? Math.round(((tw.steps - lw.steps) / lw.steps) * 100) : null },
      { label: 'Sleep', curr: tw.sleep_hours ?? (tw.flags?.includes('sleep_low') ? 0 : null), prev: lw.sleep_hours ?? (lw.flags?.includes('sleep_low') ? 0 : null), format: (v) => (v != null ? `${v}h` : '—'), delta: null },
    ] : undefined,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * Map posing media (current + previous) and poses to a ReviewItem for ReviewEngine.
 * @param {object} media - Current submission (id, clientId, uri, poseId, notes, createdAt)
 * @param {object} client - Client (id, full_name)
 * @param {object|null} pose - Current pose (name, etc.)
 * @param {object|null} previousMedia - Previous submission (uri, poseId, notes)
 * @param {object|null} previousPose - Previous pose (name)
 * @returns {import('../types').ReviewItem}
 */
export function posingToReviewItem(media, client, pose, previousMedia, previousPose) {
  const clientId = client?.id ?? media?.clientId ?? '';
  const poseName = pose?.name ?? media?.poseId ?? 'Posing';
  const prevPoseName = previousPose?.name ?? previousMedia?.poseId ?? 'Previous';

  return {
    id: media.id,
    clientId,
    type: 'posing',
    createdAt: media.createdAt,
    status: 'needs_review',
    title: client?.full_name || 'Client',
    subtitle: poseName,
    left: {
      title: 'This submission',
      imageUri: media.uri ?? undefined,
      notes: media.notes ?? undefined,
      metrics: [],
    },
    right: previousMedia ? {
      title: 'Previous',
      imageUri: previousMedia.uri ?? undefined,
      notes: previousMedia.notes ?? undefined,
      metrics: [],
    } : undefined,
  };
}
