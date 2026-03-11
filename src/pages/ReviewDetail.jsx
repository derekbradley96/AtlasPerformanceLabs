import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { toast } from 'sonner';
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { safeDate } from '@/lib/format';
import { setCheckinReviewed } from '@/lib/checkinReviewStorage';
import { getCompMediaById, markMediaReviewed, listMedia } from '@/lib/repos/compPrepRepo';
import { logAuditEvent } from '@/lib/auditLogStore';
import { getPoseById } from '@/lib/repos/poseLibraryRepo';
import { getClientRiskEvaluation } from '@/lib/riskService';
import { markReviewItemDone, getDedupeKeyForReview, getTopActiveReviewItem } from '@/lib/reviewQueueLegacy';
import { checkinToReviewItem, posingToReviewItem } from '@/features/reviewEngine/adapters';
import { ReviewEngine } from '@/features/reviewEngine';
import { useAuth } from '@/lib/AuthContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors } from '@/ui/tokens';

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

export default function ReviewDetail() {
  const { reviewType, id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientIdFromQuery = searchParams.get('clientId');
  const fromGlobal = searchParams.get('from') === 'global';
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const [coachResponse, setCoachResponse] = useState('');
  const [showSendFeedbackConfirm, setShowSendFeedbackConfirm] = useState(false);
  const [pendingSendFeedback, setPendingSendFeedback] = useState(null);

  const { reviewItem, clientId } = useMemo(() => {
    if (!reviewType || !id) return { reviewItem: null, clientId: null };

    if (reviewType === 'checkin') {
      const clientId = clientIdFromQuery || null;
      const client = clientId ? getClientById(clientId) : null;
      const checkInsListRaw = clientId ? getClientCheckIns(clientId) : [];
      const checkInsList = Array.isArray(checkInsListRaw) ? checkInsListRaw : [];
      const sorted = [...checkInsList].sort((a, b) => (safeDate(b?.submitted_at ?? b?.created_date)?.getTime() ?? 0) - (safeDate(a?.submitted_at ?? a?.created_date)?.getTime() ?? 0));
      const thisWeek = sorted.find((c) => c?.id === id);
      const idx = thisWeek ? sorted.indexOf(thisWeek) : -1;
      const lastWeek = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
      const cid = thisWeek?.client_id || clientId;
      const cl = cid ? getClientById(cid) : client;
      const risk = cid ? getClientRiskEvaluation(cid) : null;
      if (!thisWeek || !cl) return { reviewItem: null, clientId: cid };
      const item = checkinToReviewItem(thisWeek, lastWeek, cl, risk);
      return { reviewItem: item, clientId: cid };
    }

    if (reviewType === 'posing') {
      const media = getCompMediaById(id);
      const cid = media?.clientId ?? clientIdFromQuery;
      const client = cid ? getClientById(cid) : null;
      if (!media || !client) return { reviewItem: null, clientId: cid };
      const posingList = cid ? listMedia(cid, { category: 'posing' }) : [];
      const sorted = [...posingList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const currentIdx = sorted.findIndex((m) => m.id === id);
      const previousMedia = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;
      const pose = media.poseId ? getPoseById(media.poseId) : null;
      const previousPose = previousMedia?.poseId ? getPoseById(previousMedia.poseId) : null;
      const item = posingToReviewItem(media, client, pose, previousMedia, previousPose);
      return { reviewItem: item, clientId: cid };
    }

    if (reviewType === 'photo') {
      return { reviewItem: null, clientId: clientIdFromQuery };
    }

    return { reviewItem: null, clientId: null };
  }, [reviewType, id, clientIdFromQuery]);

  const handleMarkReviewed = useCallback(async () => {
    await mediumHaptic();
    if (reviewType === 'checkin' && id) {
      setCheckinReviewed(id);
      logAuditEvent({ actorUserId: user?.id ?? 'demo-trainer', ownerTrainerUserId: trainerId, entityType: 'checkin', entityId: id, action: 'review_complete', after: { clientId } });
      const weekStart = (() => {
        if (!clientId) return null;
        const list = getClientCheckIns(clientId);
        const c = list.find((x) => x.id === id);
        return c?.week_start ?? null;
      })();
      const dedupeKey = getDedupeKeyForReview(reviewType, id, clientId ?? '', weekStart);
      markReviewItemDone(dedupeKey);
      toast.success('Marked as reviewed');
      await successHaptic();
      if (fromGlobal) {
        const next = getTopActiveReviewItem(trainerId);
        if (next) {
          const nextType = next.metadata?.feedType ?? (next.type === 'posing_review' ? 'posing' : 'checkin');
          const nextId = next.id;
          const nextClientId = next.clientId ?? '';
          navigate(`/review/${nextType}/${encodeURIComponent(nextId)}?clientId=${encodeURIComponent(nextClientId)}&from=global`, { replace: true });
        } else {
          navigate('/review-global?done=1', { replace: true });
        }
        return;
      }
      if (coachResponse.trim()) {
        setPendingSendFeedback({ clientId, message: coachResponse, fallbackPath: clientId ? `/clients/${clientId}/review-center` : '/review-center' });
        setShowSendFeedbackConfirm(true);
      } else {
        navigate(clientId ? `/clients/${clientId}/review-center` : '/review-center');
      }
      return;
    }
    if (reviewType === 'posing' && id) {
      markMediaReviewed(id, coachResponse.trim() || undefined);
      logAuditEvent({ actorUserId: user?.id ?? 'demo-trainer', ownerTrainerUserId: trainerId, entityType: 'posing', entityId: id, action: 'review_complete', after: { clientId } });
      const dedupeKey = getDedupeKeyForReview(reviewType, id, clientId ?? '', null);
      markReviewItemDone(dedupeKey);
      toast.success('Marked as reviewed');
      await successHaptic();
      if (fromGlobal) {
        const next = getTopActiveReviewItem(trainerId);
        if (next) {
          const nextType = next.metadata?.feedType ?? 'posing';
          const nextId = next.id;
          const nextClientId = next.clientId ?? '';
          navigate(`/review/${nextType}/${encodeURIComponent(nextId)}?clientId=${encodeURIComponent(nextClientId)}&from=global`, { replace: true });
        } else {
          navigate('/review-global?done=1', { replace: true });
        }
        return;
      }
      navigate(clientId ? `/clients/${clientId}/review-center` : '/review-center');
      return;
    }
    if (reviewType === 'photo') {
      toast.success('Marked as reviewed');
      navigate(clientId ? `/clients/${clientId}/review-center` : '/review-center');
    }
  }, [reviewType, id, clientId, coachResponse, navigate, fromGlobal, trainerId]);

  const handleMessageClient = useCallback(
    (prefilled) => {
      navigate(`/messages/${clientId}`, { state: { prefilledMessage: prefilled || 'Quick reply from your coach' } });
    },
    [navigate, clientId]
  );

  const handleOpenProgram = useCallback(() => {
    if (clientId) navigate(`/clients/${clientId}?tab=program`);
  }, [clientId, navigate]);

  const handleSendFeedbackConfirm = useCallback(() => {
    if (pendingSendFeedback?.clientId) {
      navigate(`/messages/${pendingSendFeedback.clientId}`, { state: { prefilledMessage: pendingSendFeedback.message } });
    } else {
      navigate(pendingSendFeedback?.fallbackPath ?? '/review-center');
    }
    setShowSendFeedbackConfirm(false);
    setPendingSendFeedback(null);
  }, [pendingSendFeedback, navigate]);

  const handleSendFeedbackCancel = useCallback(() => {
    navigate(pendingSendFeedback?.fallbackPath ?? '/review-center');
    setShowSendFeedbackConfirm(false);
    setPendingSendFeedback(null);
  }, [pendingSendFeedback, navigate]);

  if (!reviewType || !id) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Invalid review link.</p>
      </div>
    );
  }

  if (reviewType === 'posing') {
    const media = getCompMediaById(id);
    if (!media) {
      return (
        <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
          <p className="text-sm">Posing submission not found.</p>
        </div>
      );
    }
    if (media.reviewedAt && !reviewItem) {
      return (
        <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
          <p className="text-sm">This submission was already reviewed.</p>
          <button
            type="button"
            onClick={() => navigate(clientId ? `/clients/${clientId}/review-center` : '/review-center')}
            className="mt-2 text-sm font-medium"
            style={{ color: colors.accent }}
          >
            Back to Review Center
          </button>
        </div>
      );
    }
  }

  if (!reviewItem) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">{reviewType === 'photo' ? 'Progress photo review not available yet.' : 'Review item not found.'}</p>
      </div>
    );
  }

  return (
    <>
      <ReviewEngine
        item={reviewItem}
        coachResponse={coachResponse}
        onCoachResponseChange={setCoachResponse}
        onMarkReviewed={handleMarkReviewed}
        onMessageClient={handleMessageClient}
        onOpenProgram={reviewType === 'checkin' ? handleOpenProgram : undefined}
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
