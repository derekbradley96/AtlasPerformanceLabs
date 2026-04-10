/**
 * Header notification bell: badge count + popover with Action required / Messages / Insights + deep links.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
} from '@/lib/notifications';
import { hasSupabase } from '@/lib/supabaseClient';
import { colors } from '@/ui/tokens';
import { hapticLight } from '@/lib/haptics';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  groupNotificationsByCategory,
} from '@/lib/notificationTaxonomy';
import { getRouteForNotification, getIconForNotificationType } from '@/lib/notificationRoutes';

const BADGE_MAX = 99;
const BELL_FETCH_LIMIT = 40;
const PER_SECTION = 6;

export default function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count', user?.id],
    queryFn: () => getUnreadNotificationCount(user?.id),
    enabled: !!user?.id && hasSupabase,
    refetchInterval: 60 * 1000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id, 'bell'],
    queryFn: () => getNotifications(user?.id, { limit: BELL_FETCH_LIMIT }),
    enabled: !!user?.id && hasSupabase && open,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
    },
  });

  const grouped = groupNotificationsByCategory(notifications);

  const handleItemClick = (n) => {
    hapticLight();
    if (!n.is_read) markReadMutation.mutate(n.id);
    const route = getRouteForNotification(n, effectiveRole);
    setOpen(false);
    if (route) navigate(route);
  };

  const count = Math.min(Number(unreadCount) || 0, BADGE_MAX);
  const showBadge = count > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
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
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className={cn(
          'w-[min(calc(100vw-24px),380px)] max-h-[min(70vh,520px)] overflow-y-auto p-0 z-[200]',
          'border shadow-xl'
        )}
        style={{ background: colors.surface1, borderColor: colors.border }}
      >
        <div
          className="sticky top-0 z-10 px-3 py-2 border-b flex items-center justify-between"
          style={{ background: colors.surface1, borderColor: colors.border }}
        >
          <span className="text-sm font-semibold" style={{ color: colors.text }}>
            Notifications
          </span>
          {showBadge && (
            <span className="text-xs" style={{ color: colors.muted }}>
              {count} unread
            </span>
          )}
        </div>

        {open && isLoading && (
          <div className="p-6 text-center text-sm" style={{ color: colors.muted }}>
            Loading…
          </div>
        )}

        {open && !isLoading && notifications.length === 0 && (
          <div className="p-6 text-center text-sm" style={{ color: colors.muted }}>
            You’re all caught up.
          </div>
        )}

        {open &&
          !isLoading &&
          CATEGORY_ORDER.map((cat) => {
            const items = (grouped[cat] || []).slice(0, PER_SECTION);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="border-b last:border-b-0" style={{ borderColor: colors.border }}>
                <div
                  className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: colors.muted, background: colors.bg }}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                <ul className="py-1">
                  {items.map((n) => {
                    const Icon = getIconForNotificationType(n.type);
                    const unread = !n.is_read;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          className="w-full flex gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                          onClick={() => handleItemClick(n)}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: unread ? 'rgba(59, 130, 246, 0.15)' : colors.surface2,
                            }}
                          >
                            <Icon
                              className="w-4 h-4"
                              style={{ color: unread ? colors.primary : colors.muted }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className="text-sm font-medium line-clamp-2"
                                style={{ color: unread ? colors.text : colors.muted }}
                              >
                                {n.title}
                              </span>
                              {unread && (
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                                  style={{ background: colors.primary }}
                                />
                              )}
                            </div>
                            <p className="text-xs line-clamp-2 mt-0.5" style={{ color: colors.muted }}>
                              {n.message}
                            </p>
                            <div className="flex items-center justify-between mt-1 gap-2">
                              <span className="text-[10px]" style={{ color: colors.muted }}>
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </span>
                              {getRouteForNotification(n, effectiveRole) && (
                                <span
                                  className="text-[10px] flex items-center gap-0.5 flex-shrink-0"
                                  style={{ color: colors.primary }}
                                >
                                  Open
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

        {open && !isLoading && notifications.length > 0 && (
          <button
            type="button"
            className="w-full py-3 text-sm font-medium text-center border-t sticky bottom-0"
            style={{
              color: colors.primary,
              background: colors.surface1,
              borderColor: colors.border,
            }}
            onClick={() => {
              hapticLight();
              setOpen(false);
              navigate('/notifications');
            }}
          >
            View all notifications
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
