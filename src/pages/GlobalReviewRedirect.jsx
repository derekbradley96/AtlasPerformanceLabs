import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * /global-review with query params: if tab or filter present, go to Review Center list; else single-item flow.
 */
export default function GlobalReviewRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'active';
  const filter = searchParams.get('filter') || 'all';

  useEffect(() => {
    const hasParams = searchParams.has('tab') || searchParams.has('filter');
    if (hasParams) {
      navigate(`/review-center?tab=${tab}&filter=${filter}`, { replace: true });
    } else {
      navigate('/review-global', { replace: true });
    }
  }, [navigate, tab, filter, searchParams]);

  return null;
}
