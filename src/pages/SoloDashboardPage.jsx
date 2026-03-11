import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import GeneralDashboard from '@/components/dashboards/GeneralDashboard';

const DEMO_USER = { id: 'demo-user', full_name: 'Demo User', user_type: 'general', email: 'demo@atlasperformancelabs.app', isDemo: true };

const mountTransition = { duration: 0.24, ease: 'easeOut' };

export default function SoloDashboardPage() {
  const { user: authUser, isDemoMode, isAdminBypass } = useAuth();
  const user = authUser || (isDemoMode ? DEMO_USER : null) || (isAdminBypass ? { id: 'admin', full_name: 'Admin', user_type: 'general' } : null);
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
      <GeneralDashboard user={user} />
    </motion.div>
  );
}
