/**
 * Notification Centre: unread and read notifications with deep links.
 * Uses public.notifications (profile_id, type, title, message, data, is_read).
 * Tap row → mark as read + navigate to linked screen when data has route.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Calendar,
  CheckSquare,
  CreditCard,
  MessageCircle,
  FileText,
  Trophy,
  Check,
  RefreshCw,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';
import { hasSupabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { PageLoader } from '@/components/ui/LoadingState';
import { formatDistanceToNow } from 'date-fns';
import { hapticLight } from '@/lib/haptics';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import EmptyState from '@/components/ui/EmptyState';

const PAGE_SIZE = 50;

/**
 * Resolve deep-link route from notification type and data.
 * Returns path string or null if no link.
 */
function getRouteForNotification(notification) {
  if (!notification?.type) return null;
  const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
  const clientId = data.client_id ?? data.clientId;
  const checkinId = data.checkin_id ?? data.checkinId;
  const threadId = data.thread_id ?? data.threadId;
  const peakWeekId = data.peak_week_id ?? data.peakWeekId;

  switch (notification.type) {
    case 'checkin_review':
      if (clientId && checkinId) return `/clients/${clientId}/checkins/${checkinId}`;
      if (clientId) return `/clients/${clientId}/review-center`;
      return '/review-center/queue';
    case 'message_received':
      if (clientId) return `/messages/${clientId}`;
      if (threadId) return '/messages';
      return '/messages';
    case 'checkin_due':
      return '/check-in';
    case 'habit_due':
    case 'habit_streak':
      return '/habits-daily';
    case 'peak_week_update':
      if (clientId) return `/clients/${clientId}/peak-week`;
      if (peakWeekId) return '/peak-week';
      return '/peak-week';
    case 'program_update':
      if (clientId) return `/clients/${clientId}`;
      return null;
    case 'payment_due':
      if (clientId) return `/clients/${clientId}/billing`;
      return '/revenue';
    default:
      return null;
  }
}

function getIconForType(type) {
  const map = {
    checkin_due: Calendar,
    checkin_review: FileText,
    message_received: MessageCircle,
    habit_due: CheckSquare,
    habit_streak: CheckSquare,
    peak_week_update: Trophy,
    program_update: FileText,
    payment_due: CreditCard,
  };
  return map[type] || Bell;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const {
    data: notifications = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user?.id, { limit: PAGE_SIZE }),
    enabled: !!user?.id && hasSupabase,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      toast.success('All marked read');
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredList =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  const handleMarkReadOnly = (e, notification) => {
    e.stopPropagation();
    hapticLight();
    if (!notification.is_read) markAsReadMutation.mutate(notification.id);
  };

  const handleRowClick = (notification) => {
    hapticLight();
    if (!notification.is_read) markAsReadMutation.mutate(notification.id);
    const route = getRouteForNotification(notification);
    if (route) {
      navigate(route);
    } else if (!notification.is_read) {
      toast.success('Marked read');
    }
  };

  if (!hasSupabase || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: colors.bg, color: colors.text }}
      >
        <p style={{ color: colors.muted }}>Sign in to see notifications.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Notifications" onBack={() => navigate(-1)} />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title="Notifications"
        onBack={() => navigate(-1)}
        rightAction={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                refetch();
              }}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: colors.muted,
                background: 'transparent',
                border: 'none',
              }}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                navigate('/settings/notifications');
              }}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: colors.muted,
                background: 'transparent',
                border: 'none',
              }}
              aria-label="Notification settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Subheader: unread count + filters */}
      <div
        className="sticky z-10 border-b px-4 py-3"
        style={{ background: colors.surface1, borderColor: colors.border }}
      >
        {unreadCount > 0 && (
          <p className="text-sm mb-3" style={{ color: colors.muted }}>
            {unreadCount} unread
          </p>
        )}
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            type="button"
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              hapticLight();
              setFilter('all');
            }}
            style={filter === 'all' ? { background: colors.primary, color: '#fff' } : {}}
          >
            All
          </Button>
          <Button
            type="button"
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              hapticLight();
              setFilter('unread');
            }}
            style={filter === 'unread' ? { background: colors.primary, color: '#fff' } : {}}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Button>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                hapticLight();
                markAllAsReadMutation.mutate();
              }}
              style={{ color: colors.primary }}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {filteredList.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'When you get new notifications they’ll show up here.'
                : 'Check-ins, messages, and other updates will appear here.'
            }
          />
        ) : (
          filteredList.map((notification) => {
            const Icon = getIconForType(notification.type);
            const route = getRouteForNotification(notification);
            const unread = !notification.is_read;
            return (
              <Card
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(notification)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(notification);
                  }
                }}
                style={{
                  padding: spacing[16],
                  borderColor: unread ? colors.primary : colors.border,
                  borderWidth: 1,
                  background: unread ? 'rgba(59, 130, 246, 0.08)' : colors.card,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: unread ? 'rgba(59, 130, 246, 0.2)' : colors.surface2,
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: unread ? colors.primary : colors.muted }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: unread ? colors.text : colors.muted }}
                      >
                        {notification.title}
                      </h3>
                      {unread && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: colors.primary }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <p className="text-sm mb-2" style={{ color: colors.muted }}>
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: colors.muted }}>
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {unread && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkReadOnly(e, notification)}
                            className="text-xs font-medium flex items-center gap-1 rounded-lg px-2 py-1 active:opacity-80"
                            style={{
                              color: colors.primary,
                              background: 'rgba(59, 130, 246, 0.12)',
                              border: 'none',
                            }}
                            aria-label="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Mark read
                          </button>
                        )}
                        {route && (
                          <span className="text-xs flex items-center gap-0.5" style={{ color: colors.primary }}>
                            Open
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
