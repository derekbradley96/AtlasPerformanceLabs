import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { 
  Bell, Check, MessageSquare, Calendar, DollarSign, 
  Target, Dumbbell, Users, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: displayUser, isDemoMode } = useAuth();
  const [filter, setFilter] = useState('all');

  const { data: notificationsData = [], isLoading } = useQuery({
    queryKey: ['notifications', displayUser?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('notification-list', { user_id: displayUser?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!displayUser?.id && !isDemoMode
  });
  const notifications = isDemoMode ? [] : notificationsData;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await invokeSupabaseFunction('notification-update', { id: notificationId, read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifs = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifs.map(n => invokeSupabaseFunction('notification-update', { id: n.id, read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  if (!displayUser) return <PageLoader />;
  if (!isDemoMode && isLoading) return <PageLoader />;

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    const iconMap = {
      checkin_submitted: Calendar,
      payment_failed: DollarSign,
      program_assigned: Target,
      program_updated: Target,
      new_message: MessageSquare,
      workout_completed: Dumbbell,
      client_joined: Users,
      intake_form_completed: Check
    };
    return iconMap[type] || Bell;
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.link_page) {
      navigate(createPageUrl(notification.link_page) + (notification.link_params || ''));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-400">{unreadCount} unread</p>
            )}
          </div>
          <Button
            onClick={() => navigate(createPageUrl('NotificationSettings'))}
            variant="ghost"
            size="icon"
            className="text-slate-400"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className={filter === 'all' ? 'bg-blue-500' : ''}
          >
            All
          </Button>
          <Button
            onClick={() => setFilter('unread')}
            variant={filter === 'unread' ? 'default' : 'ghost'}
            size="sm"
            className={filter === 'unread' ? 'bg-blue-500' : ''}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Button>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              variant="ghost"
              size="sm"
              className="ml-auto text-blue-400"
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-2">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification, i) => {
            const Icon = getNotificationIcon(notification.type);
            return (
              <motion.button
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  notification.read
                    ? 'bg-slate-800/30 border-slate-800'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    notification.read ? 'bg-slate-700' : 'bg-blue-500/20'
                  }`}>
                    <Icon className={`w-5 h-5 ${notification.read ? 'text-slate-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`font-semibold text-sm ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{notification.message}</p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}