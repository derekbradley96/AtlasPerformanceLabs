import React, { useEffect, useState } from 'react';
import { Wifi, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOfflineQueue } from '@/lib/offlineWorkoutQueue';

export default function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => getOfflineQueue().length);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount === 0) {
      setSynced(true);
      setTimeout(() => setSynced(false), 3000);
    }
  }, [isOnline, pendingCount]);

  useEffect(() => {
    const refresh = () => setPendingCount(getOfflineQueue().length);
    window.addEventListener('atlas-offline-workout-queue-changed', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('online', refresh);
    refresh();
    return () => {
      window.removeEventListener('atlas-offline-workout-queue-changed', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && pendingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 text-amber-400 text-sm font-medium"
        >
          <Wifi className="w-4 h-4 shrink-0 opacity-50" />
          <span>Offline • {pendingCount} pending operation{pendingCount === 1 ? '' : 's'}</span>
        </motion.div>
      )}

      {synced && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-green-500/20 border-b border-green-500/30 px-4 py-2 flex items-center gap-2 text-green-400 text-sm font-medium"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>Saved • Changes synced</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}