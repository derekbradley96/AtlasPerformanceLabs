import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { safeDate } from '@/lib/format';

export function useAlertStatus(user) {
  const [alertsSeen, setAlertsSeen] = useState(false);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', user?.id],
    queryFn: async () => [],
    enabled: !!user?.id,
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkins', user?.id],
    queryFn: async () => [],
    enabled: !!user?.id,
  });

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => null,
    enabled: !!user?.id && user?.user_type === 'client',
  });

  // Compute alert states
  const hasUnreadMessages = messages.some(msg => !msg.read && msg.receiver_id === user?.id);
  
  const hasFailedPayment = clientProfile?.subscription_status === 'past_due' || 
    clientProfile?.subscription_status === 'cancelled';

  const checkInsList = Array.isArray(checkIns) ? checkIns : [];
  const hasOverdueCheckIn = checkInsList.length > 0 && checkInsList.some(checkin => {
    const createdDate = safeDate(checkin?.created_date ?? checkin?.created_at);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return createdDate && createdDate < sevenDaysAgo;
  });

  const hasAlerts = (hasUnreadMessages || hasFailedPayment || hasOverdueCheckIn) && !alertsSeen;

  const markAlertsSeen = () => {
    setAlertsSeen(true);
  };

  return {
    hasAlerts,
    hasUnreadMessages,
    hasFailedPayment,
    hasOverdueCheckIn,
    markAlertsSeen,
  };
}