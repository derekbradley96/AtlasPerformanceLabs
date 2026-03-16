/**
 * Header notification bell: shows unread count badge, click opens /notifications.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { hasSupabase } from '@/lib/supabaseClient';
import { colors } from '@/ui/tokens';
import { hapticLight } from '@/lib/haptics';

const BADGE_MAX = 99;

export default function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count', user?.id],
    queryFn: () => getUnreadNotificationCount(user?.id),
    enabled: !!user?.id && hasSupabase,
    refetchInterval: 60 * 1000,
  });

  const handleClick = () => {
    hapticLight();
    navigate('/notifications');
  };

  const count = Math.min(Number(unreadCount) || 0, BADGE_MAX);
  const showBadge = count > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center rounded-lg active:opacity-80 relative"
      style={{
        minWidth: 44,
        minHeight: 44,
        color: colors.muted,
        background: 'transparent',
        border: 'none',
      }}
      aria-label={showBadge ? `${count} unread notifications` : 'Notifications'}
    >
      <Bell className="w-5 h-5" strokeWidth={2} />
      {showBadge && (
        <span
          className="absolute flex items-center justify-center rounded-full text-[10px] font-semibold"
          style={{
            top: 6,
            right: 6,
            minWidth: 16,
            height: 16,
            paddingLeft: count > 9 ? 4 : 2,
            paddingRight: count > 9 ? 4 : 2,
            background: colors.primary,
            color: '#fff',
          }}
        >
          {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
        </span>
      )}
    </button>
  );
}
