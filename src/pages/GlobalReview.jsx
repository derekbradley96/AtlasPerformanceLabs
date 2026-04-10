import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getTopActiveQueueItem } from '@/lib/reviewQueue';
import { buildCoachCheckinReviewUrl } from '@/lib/coachReviewRoutes';
import { setSessionSkipGlobalReviewTrue } from '@/lib/globalReviewSession';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';
import { deriveGlobalReviewRouteState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { normalizeReviewQueueFilterParam, REVIEW_QUEUE_PATH } from '@/lib/coachReviewRoutes';

/**
 * Review next (single-item): pull top priority active item from reviewQueue and deep-link into route.
 * Only ?done=1 is honored here; stray tab/filter params are sent to the triage queue.
 */
export default function GlobalReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const done = searchParams.get('done') === '1';

  useEffect(() => {
    if (done) return;
    if (searchParams.has('tab') || searchParams.has('filter')) {
      const filterRaw = searchParams.get('filter') || 'all';
      const mapped = normalizeReviewQueueFilterParam(filterRaw === 'all' ? null : filterRaw);
      const qs = mapped ? `?filter=${encodeURIComponent(mapped)}` : '';
      navigate(`${REVIEW_QUEUE_PATH}${qs}`, { replace: true });
    }
  }, [done, navigate, searchParams]);
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const [redirecting, setRedirecting] = useState(false);
  const [topItem, setTopItem] = useState(null);

  const globalReviewView = useMemo(() => {
    if (done) return 'done';
    if (!topItem) return 'idle';
    return 'redirecting';
  }, [done, topItem]);

  const globalReviewMigration = useMemo(
    () => deriveGlobalReviewRouteState({ view: globalReviewView }),
    [globalReviewView]
  );

  useEffect(() => {
    let cancelled = false;
    getTopActiveQueueItem(trainerId).then((item) => {
      if (!cancelled) setTopItem(item);
    });
    return () => { cancelled = true; };
  }, [trainerId]);

  useEffect(() => {
    if (done || !topItem || redirecting) return;
    setRedirecting(true);
    if (topItem.route) {
      navigate(topItem.route + (topItem.route.includes('?') ? '&' : '?') + 'from=global', { replace: true });
    } else if (topItem.type === 'CHECKIN_REVIEW') {
      const u = buildCoachCheckinReviewUrl(topItem.id, topItem.clientId);
      navigate(`${u}${u.includes('?') ? '&' : '?'}from=global`, { replace: true });
    } else if (topItem.type === 'POSING_REVIEW') {
      navigate(`/comp-prep/review/${encodeURIComponent(topItem.id)}?clientId=${encodeURIComponent(topItem.clientId ?? '')}&from=global`, { replace: true });
    } else {
      navigate(topItem.route || REVIEW_QUEUE_PATH, { replace: true });
    }
  }, [done, topItem, navigate, redirecting]);

  const handleBackToHome = () => {
    setSessionSkipGlobalReviewTrue();
    navigate('/home', { replace: true });
  };

  // Just finished all: show All clear
  if (done) {
    return (
      <div
        className="app-screen min-w-0 max-w-full flex flex-col items-center justify-center relative"
        {...atlasMigrationDataAttributes(globalReviewMigration.phase, globalReviewMigration.primary)}
        style={{
          minHeight: '60vh',
          padding: spacing[24],
          background: colors.bg,
          color: colors.text,
        }}
      >
        <button
          type="button"
          onClick={handleBackToHome}
          className="flex items-center gap-2 text-[15px] font-medium border-none bg-transparent"
          style={{ position: 'absolute', left: spacing[16], top: spacing[16], color: colors.accent }}
        >
          <ArrowLeft size={20} /> Back to Home
        </button>
        <EmptyState
          icon={Check}
          title="All clear."
          subtext="No more items in your queue. Pull to refresh or open your review queue for the full list."
        />
        <Button
          variant="primary"
          onClick={() => navigate(REVIEW_QUEUE_PATH)}
          style={{ marginTop: spacing[16] }}
        >
          Open review queue
        </Button>
      </div>
    );
  }

  // No active item: show All clear
  if (!topItem) {
    return (
      <div
        className="app-screen min-w-0 max-w-full flex flex-col items-center justify-center relative"
        {...atlasMigrationDataAttributes(globalReviewMigration.phase, globalReviewMigration.primary)}
        style={{
          minHeight: '60vh',
          padding: spacing[24],
          background: colors.bg,
          color: colors.text,
        }}
      >
        <button
          type="button"
          onClick={handleBackToHome}
          className="flex items-center gap-2 text-[15px] font-medium border-none bg-transparent"
          style={{ position: 'absolute', left: spacing[16], top: spacing[16], color: colors.accent }}
        >
          <ArrowLeft size={20} /> Back to Home
        </button>
        <EmptyState
          icon={Check}
          title="All clear."
          subtext="No items needing review right now."
        />
        <Button
          variant="primary"
          onClick={() => navigate(REVIEW_QUEUE_PATH)}
          style={{ marginTop: spacing[16] }}
        >
          Open review queue
        </Button>
      </div>
    );
  }

  // Redirecting to reviewer (useEffect does the navigate)
  return (
    <div
      className="app-screen min-w-0 max-w-full flex items-center justify-center"
      {...atlasMigrationDataAttributes(globalReviewMigration.phase, globalReviewMigration.primary)}
      style={{ minHeight: '40vh', background: colors.bg }}
    >
      <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}
