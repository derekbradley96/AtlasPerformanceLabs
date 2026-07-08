import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseClient';
import ClientDashboard from '@/components/dashboards/ClientDashboard';
import { getPendingInvite, clearPendingInvite } from './ClientCode';
import { toast } from 'sonner';
import { applyInviteCodeForUser } from '@/lib/inviteConversion';
import { trackRecoverableError } from '@/services/frictionTracker';

const DEMO_USER = import.meta.env.DEV
  ? {
      id: 'demo-user',
      full_name: 'Demo User',
      user_type: 'client',
      email: 'demo@atlasperformancelabs.app',
      isDemo: true,
    }
  : null;

const mountTransition = { duration: 0.24, ease: 'easeOut' };

export default function ClientDashboardPage() {
  const { user: authUser, profile, isDemoMode, isAdminBypass, isLoadingAuth, refreshProfile } = useAuth();
  const [applyingInvite, setApplyingInvite] = useState(false);
  const queryClient = useQueryClient();

  if (!import.meta.env.DEV && !isLoadingAuth && !authUser?.id && !isAdminBypass) {
    // In production, redirect to auth rather than using demo
    // This prevents any demo user bleeding into prod sessions
    console.error('[ClientDashboardPage] No auth user in prod');
  }

  const user =
    authUser
    || (isDemoMode && import.meta.env.DEV ? DEMO_USER : null)
    || (isAdminBypass ? { id: 'admin', full_name: 'Admin', user_type: 'client' } : null);

  useEffect(() => {
    if (!user || user.isDemo || isAdminBypass || applyingInvite) return;
    const pending = getPendingInvite();
    if (!pending?.code) return;
    setApplyingInvite(true);
    (async () => {
      try {
        const supabase = getSupabase();
        // Never silently re-link an already-coached client: a stale join link
        // for a different coach must not hijack the relationship. Switching
        // stays possible via the explicit Enter Code page.
        if (supabase) {
          const { data: existingLink } = await supabase
            .from('clients')
            .select('coach_id, trainer_id')
            .eq('user_id', user.id)
            .maybeSingle();
          const currentCoachId = existingLink?.trainer_id ?? existingLink?.coach_id ?? null;
          if (currentCoachId && pending.trainerId && String(currentCoachId) !== String(pending.trainerId)) {
            toast.info('You already have a coach. To switch, use Enter Code in settings.');
            return;
          }
        }
        await applyInviteCodeForUser({ supabase, user, inviteCode: pending.code });
        await queryClient.invalidateQueries({ queryKey: ['client-profile'] });
        await refreshProfile?.();
        toast.success('Joined trainer');
      } catch (e) {
        trackRecoverableError('ClientDashboardPage', 'applyInviteCodeForUser', e);
        if (import.meta.env.DEV) console.error(e);
        toast.error(e?.message || 'Could not apply invite code');
      } finally {
        clearPendingInvite();
        setApplyingInvite(false);
      }
    })();
  }, [user, isAdminBypass, applyingInvite, queryClient, refreshProfile]);

  if (!user) {
    return (
      <div className="min-h-[200px] flex items-center justify-center bg-[#0B1220]" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={mountTransition}
    >
      <ClientDashboard user={user} linkedFromPersonalAt={profile?.linked_from_personal_at} />
    </motion.div>
  );
}
