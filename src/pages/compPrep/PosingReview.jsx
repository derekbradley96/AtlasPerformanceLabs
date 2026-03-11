import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getClientById } from '@/data/selectors';
import { getCompMediaById, markMediaReviewed } from '@/lib/repos/compPrepRepo';
import { getPoseById } from '@/lib/repos/poseLibraryRepo';
import { impactMedium, notificationSuccess } from '@/lib/haptics';
import { toast } from 'sonner';
import { ReviewEngine } from '@/features/reviewEngine';
import { colors } from '@/ui/tokens';

export default function PosingReview() {
  const { mediaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientIdFromQuery = searchParams.get('clientId');
  const [coachResponse, setCoachResponse] = useState('');

  const media = useMemo(() => (mediaId ? getCompMediaById(mediaId) : null), [mediaId]);
  const clientId = media?.clientId ?? clientIdFromQuery;
  const client = useMemo(() => (clientId ? getClientById(clientId) : null), [clientId]);
  const pose = useMemo(() => (media?.poseId ? getPoseById(media.poseId) : null), [media?.poseId]);

  const reviewItem = useMemo(() => {
    if (!media || !client) return null;
    const poseName = pose?.name ?? media.poseId ?? 'Posing';
    return {
      id: media.id,
      clientId: media.clientId,
      type: 'posing',
      createdAt: media.createdAt,
      status: media.reviewedAt ? 'reviewed' : 'needs_review',
      title: client.full_name || 'Client',
      subtitle: poseName,
      left: {
        title: 'This submission',
        imageUri: media.mediaType === 'photo' ? media.uri : undefined,
        notes: media.notes,
        metrics: media.poseId ? [{ label: 'Pose', value: poseName }] : undefined,
      },
      right: pose
        ? { title: 'Reference', metrics: [{ label: 'Pose', value: poseName }], notes: pose.description ?? undefined }
        : undefined,
    };
  }, [media, client, pose]);

  const handleMarkReviewed = async () => {
    await impactMedium();
    if (mediaId) markMediaReviewed(mediaId, coachResponse.trim() || undefined);
    notificationSuccess();
    toast.success('Marked as reviewed');
    if (clientId) {
      navigate(`/comp-prep/media?clientId=${encodeURIComponent(clientId)}`);
    } else {
      navigate('/comp-prep');
    }
  };

  const handleMessageClient = (prefilled) => {
    navigate(`/messages/${clientId}`, { state: { prefilledMessage: prefilled || 'Quick reply from your coach' } });
  };

  if (!media) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Posing submission not found.</p>
      </div>
    );
  }

  if (media.reviewedAt) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">This submission was already reviewed.</p>
        <button
          type="button"
          onClick={() => navigate(clientId ? `/comp-prep/media?clientId=${clientId}` : '/comp-prep')}
          className="mt-2 text-sm font-medium"
          style={{ color: colors.accent }}
        >
          Back to Media
        </button>
      </div>
    );
  }

  if (!reviewItem) return null;

  return (
    <ReviewEngine
      item={reviewItem}
      coachResponse={coachResponse}
      onCoachResponseChange={setCoachResponse}
      onMarkReviewed={handleMarkReviewed}
      onMessageClient={handleMessageClient}
    />
  );
}
