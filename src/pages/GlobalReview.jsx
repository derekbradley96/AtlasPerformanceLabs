import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getTopActiveQueueItem } from '@/lib/reviewQueue';
import { setSessionSkipGlobalReviewTrue } from '@/lib/globalReviewSession';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';

/**
 * Global Review (single-item): pull top priority active item and deep-link into route.
 * After marking reviewed, redirect back here with ?done=1 or to next item.
 */
export default function GlobalReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const done = searchParams.get('done') === '1';
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const [redirecting, setRedirecting] = useState(false);
  const [topItem, setTopItem] = useState(null);

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
      navigate(`/review/checkin/${encodeURIComponent(topItem.id)}?clientId=${encodeURIComponent(topItem.clientId ?? '')}&from=global`, { replace: true });
    } else if (topItem.type === 'POSING_REVIEW') {
      navigate(`/comp-prep/review/${encodeURIComponent(topItem.id)}?clientId=${encodeURIComponent(topItem.clientId ?? '')}&from=global`, { replace: true });
    } else {
      navigate(topItem.route || '/review-center', { replace: true });
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
          subtext="No more items in your queue. Pull to refresh or open Review Center for the full list."
        />
        <Button
          variant="primary"
          onClick={() => navigate('/review-center')}
          style={{ marginTop: spacing[16] }}
        >
          Open Review Center
        </Button>
      </div>
    );
  }

  // No active item: show All clear
  if (!topItem) {
    return (
      <div
        className="app-screen min-w-0 max-w-full flex flex-col items-center justify-center relative"
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
          onClick={() => navigate('/review-center')}
          style={{ marginTop: spacing[16] }}
        >
          Open Review Center
        </Button>
      </div>
    );
  }

  // Redirecting to reviewer (useEffect does the navigate)
  return (
    <div className="app-screen min-w-0 max-w-full flex items-center justify-center" style={{ minHeight: '40vh', background: colors.bg }}>
      <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}
