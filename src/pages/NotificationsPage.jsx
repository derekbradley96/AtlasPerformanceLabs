/**
 * Notification Center UI: recent notifications from public.notifications (Supabase).
 * - List ordered by created_at (newest first)
 * - Tap row → mark as read + navigate when type has a route
 * - Mark read only → check button (no navigation)
 * - Mark all read + All / Unread filter
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Dumbbell,
  Calendar,
  CheckSquare,
  Camera,
  CreditCard,
  Settings,
  Flag,
  AlertCircle,
  Check,
  RefreshCw,
  Pills,
} from 'lucide-react';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { PageLoader } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { impactLight } from '@/lib/haptics';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

/** Route when user taps a notification (by type). Unknown types: mark read only. */
const TYPE_TO_ROUTE = {
  workout_due: '/today',
  workout_evening_reminder: '/today',
  checkin_due: '/check-in',
  habit_missing: '/today',
  prep_pose_check_due: '/pose-check',
  billing_due: '/settings/account',
  checkin_submitted: '/review-center/checkins',
  pose_check_submitted: '/review-center/pose-checks',
  client_flag_created: '/review-center/queue',
  billing_failed: '/money',
  supplement_morning_reminder: '/client/supplements',
  supplement_evening_reminder: '/client/supplements',
  supplement_missed_reminder: '/client/supplements',
};

function getIconForType(type) {
  const map = {
    workout_due: Dumbbell,
    workout_evening_reminder: Dumbbell,
    checkin_due: Calendar,
    habit_missing: CheckSquare,
    prep_pose_check_due: Camera,
    billing_due: CreditCard,
    checkin_submitted: Calendar,
    pose_check_submitted: Camera,
    client_flag_created: Flag,
    billing_failed: AlertCircle,
    supplement_morning_reminder: Pills,
    supplement_evening_reminder: Pills,
    supplement_missed_reminder: Pills,
  };
  return map[type] || Bell;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');

  const { data: notifications = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !user?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && hasSupabase(),
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id) => {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !user?.id) return;
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All marked read');
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  const markReadOnly = (e, notification) => {
    e.stopPropagation();
    impactLight();
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleRowClick = (notification) => {
    impactLight();
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    const route = notification.type && TYPE_TO_ROUTE[notification.type];
    if (route) {
      navigate(route);
    } else if (!notification.is_read) {
      toast.success('Marked read');
    }
  };

  if (!hasSupabase() || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
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
              onClick={() => { impactLight(); refetch(); }}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{ minWidth: 44, minHeight: 44, color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => { impactLight(); navigate('/settings/notifications'); }}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{ minWidth: 44, minHeight: 44, color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Notification settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Subheader: unread + filters */}
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
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            className={filter === 'all' ? '' : ''}
            style={filter === 'all' ? { background: colors.primary, color: '#fff' } : {}}
          >
            All
          </Button>
          <Button
            type="button"
            onClick={() => setFilter('unread')}
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            style={filter === 'unread' ? { background: colors.primary, color: '#fff' } : {}}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Button>
          {unreadCount > 0 && (
            <Button
              type="button"
              onClick={() => markAllAsReadMutation.mutate()}
              variant="ghost"
              size="sm"
              className="ml-auto"
              style={{ color: colors.accent }}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card style={{ padding: spacing[32], textAlign: 'center' }}>
            <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: colors.muted }} />
            <p style={{ color: colors.muted }}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </Card>
        ) : (
          filteredNotifications.map((notification, i) => {
            const Icon = getIconForType(notification.type);
            const route = notification.type && TYPE_TO_ROUTE[notification.type];
            const unread = !notification.is_read;
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card
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
                        style={{ color: unread ? colors.accent : colors.muted }}
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
                              onClick={(e) => markReadOnly(e, notification)}
                              className="text-xs font-medium flex items-center gap-1 rounded-lg px-2 py-1 active:opacity-80"
                              style={{
                                color: colors.accent,
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
                            <span className="text-xs" style={{ color: colors.accent }}>
                              Tap to open
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
