import { getTrainingAdjustmentWhySentence } from '@/lib/autoAdjustmentClarity';

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function modeBadgeTone(mode) {
  if (mode === 'heavy') return { bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.34)', text: '#86efac' };
  if (mode === 'light') return { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.34)', text: '#fcd34d' };
  return { bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.34)', text: '#93c5fd' };
}

export function deriveSessionModeState({
  role = 'personal',
  readinessLogged,
  checkinInputs,
  caloriePct,
  proteinPct,
  recommendation,
  adherencePct,
  enhanced = false,
  latestAdjustmentSummary = null,
}) {
  const energy = n(checkinInputs?.energy);
  const recovery = n(checkinInputs?.recovery);
  const sleepQuality = n(checkinInputs?.sleep_quality ?? checkinInputs?.sleepQuality ?? checkinInputs?.sleep);
  const stress = n(checkinInputs?.stress);
  const appetite = n(checkinInputs?.appetite ?? checkinInputs?.hunger);
  const cPct = n(caloriePct);
  const pPct = n(proteinPct);
  const adherence = n(adherencePct);

  if (!readinessLogged) {
    return {
      mode: null,
      badge: null,
      explanation: 'Log your daily check-in to personalise today’s session.',
      details: null,
      tone: modeBadgeTone('moderate'),
      whyLine: null,
      tweakPreview: null,
    };
  }

  const underFueling = (cPct != null && cPct < 65) || (pPct != null && pPct < 65) || (appetite != null && appetite <= 2);
  const strongLowSignal = (
    (energy != null && energy <= 2)
    || (recovery != null && recovery <= 2)
    || (sleepQuality != null && sleepQuality <= 2)
    || (stress != null && stress >= 4)
    || underFueling
  );
  const strongHighSignal = (
    (energy != null && energy >= 4)
    && (recovery != null && recovery >= 4)
    && (sleepQuality != null && sleepQuality >= 3)
    && (stress != null && stress <= 3)
    && !underFueling
  );

  const recType = String(recommendation?.recommendation_type || '').toLowerCase();
  let mode = 'moderate';
  if (strongLowSignal || recType === 'recovery_session' || recType === 'reduce_volume' || recType === 'reduce_intensity') mode = 'light';
  else if (strongHighSignal && recType !== 'deload_recommendation') mode = 'heavy';

  let explanation = 'Today looks like a normal training day.';
  if (mode === 'heavy') explanation = "You're ready to push today.";
  if (mode === 'light') explanation = 'Recovery is lower today, keep the session lighter.';

  let details = null;
  if (mode === 'heavy') details = 'Sleep and recovery look strong.';
  else if (mode === 'light') details = 'Focus on quality reps and controlled effort.';
  else details = "Train well, but don't force it.";

  const coachAware = role === 'client'
    ? "Today's session has been adjusted based on your check-in."
    : null;
  const whyLine = enhanced ? (getTrainingAdjustmentWhySentence(recommendation) || coachAware) : null;

  let tweakPreview = null;
  if (enhanced && latestAdjustmentSummary?.summary) {
    tweakPreview = latestAdjustmentSummary.summary;
  } else if (enhanced && mode === 'light' && underFueling) {
    tweakPreview = 'Fuel first, then keep training quality high with controlled effort.';
  } else if (enhanced && mode === 'heavy' && adherence != null && adherence >= 80) {
    tweakPreview = 'Consistency is strong this week - execute your planned work sets.';
  }

  return {
    mode,
    badge: mode === 'heavy' ? 'Heavy' : mode === 'light' ? 'Light' : 'Moderate',
    explanation,
    details,
    tone: modeBadgeTone(mode),
    whyLine,
    tweakPreview,
  };
}

