import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase } from '@/lib/supabaseClient';
import { getInProgressSession } from '@/lib/workoutSessionApi';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { PageLoader } from '@/components/ui/LoadingState';

/**
 * Personal shell entry at /workout: send users to the player when they have
 * an active session or today’s assignment; otherwise to the manual plan builder.
 */
export default function WorkoutPlayerRedirect() {
  const { user } = useAuth();
  const uid = user?.id;
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) {
        if (!cancelled) setTarget('/program-builder?personal=1');
        return;
      }
      if (!hasSupabase) {
        if (!cancelled) setTarget('/workout-player');
        return;
      }
      const session = await getInProgressSession({ profileId: uid });
      if (cancelled) return;
      if (session?.id) {
        setTarget('/workout-player');
        return;
      }
      const aw = await getAssignedWorkoutForToday({ role: 'personal', profileId: uid });
      if (cancelled) return;
      if (aw?.day) {
        setTarget('/workout-player');
        return;
      }
      setTarget('/program-builder?personal=1');
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (!target) return <PageLoader />;
  return <Navigate to={target} replace />;
}
