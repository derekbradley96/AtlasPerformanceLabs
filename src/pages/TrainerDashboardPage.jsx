import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Moon } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import TrainerDashboard from '@/pages/TrainerDashboard';
import { colors } from '@/ui/tokens';
import { getTrainerSilentMode } from '@/lib/trainerPreferencesStorage';

const mountTransition = { duration: 0.24, ease: 'easeOut' };

export default function TrainerDashboardPage() {
  const outletContext = useOutletContext() || {};
  const { setHeaderRight, registerRefresh } = outletContext;
  const { user: authUser, isAdminBypass } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const user = authUser || (isAdminBypass ? { id: 'admin', full_name: 'Admin', user_type: 'trainer' } : null);
  const silentMode = getTrainerSilentMode();

  useEffect(() => {
    if (typeof registerRefresh !== 'function') return;
    return registerRefresh(() => setRefreshKey((k) => k + 1));
  }, [registerRefresh]);

  useEffect(() => {
    if (typeof setHeaderRight !== 'function') return;
    if (silentMode) {
      setHeaderRight(<span className="flex items-center justify-center" style={{ width: 32 }} aria-label="Silent Mode"><Moon size={18} style={{ color: colors.muted }} /></span>);
    } else {
      setHeaderRight(null);
    }
    return () => setHeaderRight(null);
  }, [silentMode, setHeaderRight]);

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
      <TrainerDashboard user={user} refreshKey={refreshKey} />
    </motion.div>
  );
}
