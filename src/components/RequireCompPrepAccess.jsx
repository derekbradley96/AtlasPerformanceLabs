/**
 * Renders children only when coaching focus allows Comp Prep (Competition | Integrated).
 * Transformation-only coaches are redirected to More with a toast. Prep-only modules: posing, federation tools.
 */
import React, { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function RequireCompPrepAccess() {
  const navigate = useNavigate();
  const { hasCompetitionPrep } = useAuth();

  useEffect(() => {
    if (!hasCompetitionPrep) {
      toast.info('Not available for your coaching focus.');
      navigate('/more', { replace: true });
    }
  }, [hasCompetitionPrep, navigate]);

  if (!hasCompetitionPrep) {
    return null;
  }

  return <Outlet />;
}
