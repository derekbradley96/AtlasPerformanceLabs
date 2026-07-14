import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import GeneralDashboard from '@/components/dashboards/GeneralDashboard';
import { PageLoader } from '@/components/ui/LoadingState';
import { colors, spacing } from '@/ui/tokens';

const DEMO_USER = { id: 'demo-user', full_name: 'Demo User', user_type: 'personal', email: 'demo@atlasperformancelabs.app', isDemo: true };

const mountTransition = { duration: 0.24, ease: 'easeOut' };

export default function SoloDashboardPage() {
  const { user: authUser, isDemoMode, isAdminBypass } = useAuth();
  const user = authUser || (isDemoMode ? DEMO_USER : null) || (isAdminBypass ? { id: 'admin', full_name: 'Admin', user_type: 'personal' } : null);
  if (!user) {
    return (
      <div
        className="min-h-[40vh] flex flex-col items-center justify-center"
        style={{
          background: colors.bg,
          paddingTop: `${spacing[24]}px`,
          paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <PageLoader />
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={mountTransition}
    >
      <GeneralDashboard user={user} />
    </motion.div>
  );
}
