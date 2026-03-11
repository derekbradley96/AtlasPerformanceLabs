import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { toast } from 'sonner';
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { safeDate } from '@/lib/format';
import { setCheckinReviewed } from '@/lib/checkinReviewStorage';
import { logAuditEvent } from '@/lib/auditLogStore';
import { getClientRiskEvaluation } from '@/lib/riskService';
import { normalizePhase } from '@/lib/intelligence/clientRisk';
import { ReviewEngine } from '@/features/reviewEngine';
import { useAuth } from '@/lib/AuthContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors } from '@/ui/tokens';

const PHASE_EXPECTATIONS = {
  cut: 'In a cut, minor strength drop is expected. Focus on adherence and steps.',
  bulk: 'In a bulk, aim for steady weight gain. Some strength gain is expected.',
  maintenance: 'In maintenance, weight should stay within a small band. Strength can be maintained or improved.',
};

/** Derive suggested action from risk flags and phase. */
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

async function mediumHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}
async function successHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.notification({ type: NotificationType.Success });
    else if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
  } catch (e) {}
}

export default function CheckinReview() {
  const { id: clientId, checkinId } = useParams();
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const [coachResponse, setCoachResponse] = useState('');

  const client = clientId ? getClientById(clientId) : null;
  const checkInsList = useMemo(() => {
    const raw = clientId ? getClientCheckIns(clientId) : [];
    const list = Array.isArray(raw) ? raw : [];
    return [...list].sort((a, b) => {
      const da = safeDate(a?.submitted_at ?? a?.created_date)?.getTime() ?? 0;
      const db = safeDate(b?.submitted_at ?? b?.created_date)?.getTime() ?? 0;
      return db - da;
    });
  }, [clientId]);

  const thisWeek = checkinId ? checkInsList.find((c) => c?.id === checkinId) : null;
  const thisWeekIndex = thisWeek ? checkInsList.indexOf(thisWeek) : -1;
  const lastWeek = thisWeekIndex >= 0 && thisWeekIndex < checkInsList.length - 1 ? checkInsList[thisWeekIndex + 1] : null;

  const phase = useMemo(() => normalizePhase(client?.phase), [client?.phase]);
  const phaseLabel = phase === 'cut' ? 'Cut' : phase === 'bulk' ? 'Bulk' : 'Maintenance';
  const riskEvaluation = useMemo(
    () => (client && clientId ? getClientRiskEvaluation(clientId) : null),
    [clientId, client, checkInsList]
  );
  const suggestedAction = getSuggestedAction(riskEvaluation);

  const deltas = useMemo(() => {
    if (!thisWeek || !lastWeek) return { adherenceWarning: null, weightNote: null };
    const adherenceDrop = lastWeek.adherence_pct != null && thisWeek.adherence_pct != null
      ? lastWeek.adherence_pct - thisWeek.adherence_pct
      : null;
    const weightChange = lastWeek.weight_kg != null && thisWeek.weight_kg != null && lastWeek.weight_kg > 0
      ? ((thisWeek.weight_kg - lastWeek.weight_kg) / lastWeek.weight_kg) * 100
      : null;
    return {
      adherenceWarning: adherenceDrop != null && adherenceDrop > 10 ? `Adherence down ${adherenceDrop}% from last week` : null,
      weightNote: weightChange != null && Math.abs(weightChange) > 1 ? `Weight ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}% vs last week` : null,
    };
  }, [thisWeek, lastWeek]);

  const reviewItem = useMemo(() => {
    if (!client || !thisWeek) return null;
    const tw = thisWeek;
    const lw = lastWeek;
    const weightDelta = lw?.weight_kg != null && tw.weight_kg != null && lw.weight_kg > 0
      ? Math.round(((tw.weight_kg - lw.weight_kg) / lw.weight_kg) * 100)
      : null;
    const adherenceDelta = lw?.adherence_pct != null && tw.adherence_pct != null ? tw.adherence_pct - lw.adherence_pct : null;
    const stepsDelta = lw?.steps != null && tw.steps != null && lw.steps > 0
      ? Math.round(((tw.steps - lw.steps) / lw.steps) * 100)
      : null;
    const weightTrend = weightDelta != null && weightDelta !== 0 ? (weightDelta > 0 ? 'up' : 'down') : null;
    const adherenceTrend = adherenceDelta != null && adherenceDelta !== 0 ? (adherenceDelta > 0 ? 'up' : 'down') : null;
    const stepsTrend = stepsDelta != null && stepsDelta !== 0 ? (stepsDelta > 0 ? 'up' : 'down') : null;

    const warnings = [];
    if (deltas.adherenceWarning) warnings.push(deltas.adherenceWarning);
    if (deltas.weightNote) warnings.push(deltas.weightNote);

    return {
      id: tw.id,
      clientId,
      type: 'checkin',
      createdAt: tw.submitted_at || tw.created_date,
      status: 'needs_review',
      title: client.full_name || 'Client',
      left: {
        title: 'This week',
        metrics: [
          {
            label: 'Weight (avg)',
            value: tw.weight_kg != null ? `${tw.weight_kg} kg` : null,
            delta: weightDelta,
            deltaWarning: deltas.weightNote,
            trend: weightTrend,
          },
          {
            label: 'Adherence',
            value: tw.adherence_pct != null ? `${tw.adherence_pct}%` : null,
            delta: adherenceDelta,
            deltaWarning: deltas.adherenceWarning,
            trend: adherenceTrend,
          },
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
      riskReasons: riskEvaluation?.riskReasons,
      suggestedAction,
      diffRows: lw ? [
        {
          label: 'Weight',
          curr: tw.weight_kg,
          prev: lw.weight_kg,
          format: (v) => (v != null ? `${v} kg` : '—'),
          delta: tw.weight_kg != null && lw.weight_kg != null && lw.weight_kg > 0 ? ((tw.weight_kg - lw.weight_kg) / lw.weight_kg) * 100 : null,
        },
        {
          label: 'Adherence',
          curr: tw.adherence_pct,
          prev: lw.adherence_pct,
          format: (v) => (v != null ? `${v}%` : '—'),
          delta: tw.adherence_pct != null && lw.adherence_pct != null ? tw.adherence_pct - lw.adherence_pct : null,
        },
        {
          label: 'Steps',
          curr: tw.steps,
          prev: lw.steps,
          format: (v) => (v != null ? Number(v).toLocaleString() : '—'),
          delta: tw.steps != null && lw.steps != null && lw.steps > 0 ? Math.round(((tw.steps - lw.steps) / lw.steps) * 100) : null,
        },
        {
          label: 'Sleep',
          curr: tw.sleep_hours ?? (tw.flags?.includes('sleep_low') ? 0 : null),
          prev: lw.sleep_hours ?? (lw.flags?.includes('sleep_low') ? 0 : null),
          format: (v) => (v != null ? `${v}h` : '—'),
          delta: null,
        },
      ] : undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  }, [client, thisWeek, lastWeek, phase, phaseLabel, riskEvaluation, suggestedAction, deltas, clientId]);

  const [showSendFeedbackConfirm, setShowSendFeedbackConfirm] = useState(false);
  const [pendingSendFeedback, setPendingSendFeedback] = useState(null);

  const handleMarkReviewed = async () => {
    await mediumHaptic();
    if (checkinId) {
      setCheckinReviewed(checkinId);
      logAuditEvent({ actorUserId: user?.id ?? 'demo-trainer', ownerTrainerUserId: trainerId, entityType: 'checkin', entityId: checkinId, action: 'review_complete', after: { clientId } });
    }
    await successHaptic();
    toast.success('Marked as reviewed');
    if (coachResponse.trim()) {
      setPendingSendFeedback({ clientId, message: coachResponse });
      setShowSendFeedbackConfirm(true);
    } else {
      navigate(`/clients/${clientId}?tab=checkins`);
    }
  };

  const handleSendFeedbackConfirm = useCallback(() => {
    if (pendingSendFeedback?.clientId) {
      navigate(`/messages/${pendingSendFeedback.clientId}`, { state: { prefilledMessage: pendingSendFeedback.message } });
    } else {
      navigate(`/clients/${clientId}?tab=checkins`);
    }
    setShowSendFeedbackConfirm(false);
    setPendingSendFeedback(null);
  }, [pendingSendFeedback, clientId, navigate]);

  const handleSendFeedbackCancel = useCallback(() => {
    navigate(`/clients/${clientId}?tab=checkins`);
    setShowSendFeedbackConfirm(false);
    setPendingSendFeedback(null);
  }, [clientId, navigate]);

  const handleMessageClient = (prefilled) => {
    navigate(`/messages/${clientId}`, { state: { prefilledMessage: prefilled || 'Quick reply from your coach' } });
  };

  const handleOpenProgram = () => {
    navigate(`/clients/${clientId}?tab=program`);
  };

  if (!client || !thisWeek) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Check-in not found.</p>
      </div>
    );
  }

  if (!reviewItem) return null;

  return (
    <>
      <ReviewEngine
        item={reviewItem}
        coachResponse={coachResponse}
        onCoachResponseChange={setCoachResponse}
        onMarkReviewed={handleMarkReviewed}
        onMessageClient={handleMessageClient}
        onOpenProgram={handleOpenProgram}
      />
      <ConfirmDialog
        open={showSendFeedbackConfirm}
        title="Send message to client?"
        message="Your feedback will be prefilled in a new message to the client."
        confirmLabel="Send"
        cancelLabel="Skip"
        variant="default"
        onConfirm={handleSendFeedbackConfirm}
        onCancel={handleSendFeedbackCancel}
      />
    </>
  );
}
