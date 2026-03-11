import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import ClientDashboard from '@/components/dashboards/ClientDashboard';
import { getPendingInvite, clearPendingInvite } from './ClientCode';
import { toast } from 'sonner';

const DEMO_USER = { id: 'demo-user', full_name: 'Demo User', user_type: 'client', email: 'demo@atlasperformancelabs.app', isDemo: true };

const mountTransition = { duration: 0.24, ease: 'easeOut' };

export default function ClientDashboardPage() {
  const { user: authUser, isDemoMode, isAdminBypass } = useAuth();
  const [applyingInvite, setApplyingInvite] = useState(false);
  const queryClient = useQueryClient();
  const user = authUser || (isDemoMode ? DEMO_USER : null) || (isAdminBypass ? { id: 'admin', full_name: 'Admin', user_type: 'client' } : null);

  useEffect(() => {
    if (!user || user.isDemo || isAdminBypass || applyingInvite) return;
    const pending = getPendingInvite();
    if (!pending?.code) return;
    setApplyingInvite(true);
    (async () => {
      try {
        const { data } = await invokeSupabaseFunction('validateInviteCode', { code: pending.code });
        if (!data?.valid) {
          clearPendingInvite();
          setApplyingInvite(false);
          return;
        }
        const trainerProfileId = data.trainer_id ?? data.trainerProfileId;
        const { data: profileList } = await invokeSupabaseFunction('client-profile-list', { user_id: user.id });
        const clientProfiles = Array.isArray(profileList) ? profileList : [];
        let clientProfile = clientProfiles[0];
        if (!clientProfile) {
          const { data: created } = await invokeSupabaseFunction('client-profile-create', {
            user_id: user.id,
            trainer_id: trainerProfileId,
            subscription_status: 'pending',
          });
          clientProfile = created ?? {};
        } else {
          await invokeSupabaseFunction('client-profile-update', { id: clientProfile.id, trainer_id: trainerProfileId });
        }
        if (user.user_type !== 'client' && user.role !== 'client') {
          await invokeSupabaseFunction('user-update-role', { user_type: 'client' });
        }
        queryClient.invalidateQueries({ queryKey: ['client-profile'] });
        toast.success('Joined trainer');
      } catch (e) {
        console.error(e);
        toast.error('Could not apply invite code');
      } finally {
        clearPendingInvite();
        setApplyingInvite(false);
      }
    })();
  }, [user, isAdminBypass, applyingInvite, queryClient]);

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
      <ClientDashboard user={user} />
    </motion.div>
  );
}
