import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { navigateToThread } from '@/lib/messagesPath';
import { getSupabase } from '@/lib/supabaseClient';
import * as sandbox from '@/lib/sandboxStore';
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
  const supabase = getSupabase();
  const clientIdFromQuery = searchParams.get('clientId');
  const [coachResponse, setCoachResponse] = useState('');

  const media = useMemo(() => (mediaId ? getCompMediaById(mediaId) : null), [mediaId]);
  const clientId = media?.clientId ?? clientIdFromQuery;

  const { data: client = null, isLoading: clientLoading } = useQuery({
    queryKey: ['comp-client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      if (supabase) {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, user_id, coach_id, trainer_id')
          .eq('id', clientId)
          .maybeSingle();
        if (error || !data) return null;
        return { ...data, full_name: data.name ?? data.full_name };
      }
      const c = sandbox.getClientById(clientId);
      return c ? { ...c, full_name: c.full_name ?? c.name } : null;
    },
    enabled: !!clientId,
    staleTime: 10 * 60 * 1000,
  });

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
    navigateToThread(navigate, clientId, { state: { prefilledMessage: prefilled || 'Quick reply from your coach' } });
  };

  if (!media) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Posing submission not found.</p>
      </div>
    );
  }

  if (clientId && clientLoading) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Loading…</p>
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
