/**
 * Notification Centre: sections (Action required / Messages / Insights), deep links, read state.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, RefreshCw, Settings, ChevronRight } from 'lucide-react';
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
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  groupNotificationsByCategory,
} from '@/lib/notificationTaxonomy';
import { getRouteForNotification, getIconForNotificationType } from '@/lib/notificationRoutes';
import { deriveNotificationsSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';

const PAGE_SIZE = 50;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const [filter, setFilter] = useState('all');

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
  const grouped = groupNotificationsByCategory(filteredList);

  const notificationsMigration = useMemo(
    () =>
      deriveNotificationsSurfaceState({
        loading: isLoading,
        isEmpty: filteredList.length === 0,
        filter,
      }),
    [isLoading, filteredList.length, filter]
  );

  const handleMarkReadOnly = (e, notification) => {
    e.stopPropagation();
    hapticLight();
    if (!notification.is_read) markAsReadMutation.mutate(notification.id);
  };

  const handleRowClick = (notification) => {
    hapticLight();
    if (!notification.is_read) markAsReadMutation.mutate(notification.id);
    const route = getRouteForNotification(notification, effectiveRole);
    if (route) {
      navigate(route);
    } else if (!notification.is_read) {
      toast.success('Marked read');
    }
  };

  const renderCard = (notification) => {
    const Icon = getIconForNotificationType(notification.type);
    const route = getRouteForNotification(notification, effectiveRole);
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
            <Icon className="w-5 h-5" style={{ color: unread ? colors.primary : colors.muted }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm" style={{ color: unread ? colors.text : colors.muted }}>
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
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
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
    <div
      className="min-h-screen pb-24"
      {...atlasMigrationDataAttributes(notificationsMigration.phase, notificationsMigration.primary)}
      style={{ background: colors.bg, color: colors.text }}
    >
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

      <div className="p-4 space-y-6">
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
          CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat] || [];
            if (items.length === 0) return null;
            return (
              <section key={cat} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide px-0.5" style={{ color: colors.muted }}>
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                <div className="space-y-3">{items.map((n) => renderCard(n))}</div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
