import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { normalizeReviewQueueFilterParam, REVIEW_QUEUE_PATH } from '@/lib/coachReviewRoutes';

/**
 * /global-review: with tab/filter → global triage queue (mapped ?filter= only; `tab` is legacy/no-op).
 * With no params → `/review-global` (“review next” single-item flow).
 */
export default function GlobalReviewRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hasParams = searchParams.has('tab') || searchParams.has('filter');
    if (hasParams) {
      const filterRaw = searchParams.get('filter') || 'all';
      const mapped = normalizeReviewQueueFilterParam(filterRaw === 'all' ? null : filterRaw);
      const qs = mapped ? `?filter=${encodeURIComponent(mapped)}` : '';
      navigate(`${REVIEW_QUEUE_PATH}${qs}`, { replace: true });
    } else {
      navigate('/review-global', { replace: true });
    }
  }, [navigate, searchParams]);

  return null;
}
