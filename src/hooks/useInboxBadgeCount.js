import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseClient';
import { getThreadsForUser } from '@/lib/messaging/supabaseMessaging';
import { normalizeRole, isCoach, isClient } from '@/lib/roles';
import { getDeletedIds } from '@/lib/deletedThreadsStore';

/**
 * Unread messaging: number of threads with unread_count > 0 (coach or client), from Supabase.
 * Refetches on interval and when messaging realtime / custom events fire.
 */
export function useInboxBadgeCount() {
  const { user, effectiveRole } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const r = normalizeRole(effectiveRole);
  const threadRole = isCoach(r) ? 'coach' : isClient(r) ? 'client' : null;

  const { data: threads = [] } = useQuery({
    queryKey: ['inbox-badge-threads', user?.id, threadRole],
    queryFn: () => getThreadsForUser(supabase, user?.id, threadRole),
    enabled: Boolean(user?.id && supabase && threadRole),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const bump = () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-badge-threads'] });
    };
    window.addEventListener('atlas-messaging-updated', bump);
    window.addEventListener('atlas-deleted-threads-changed', bump);
    return () => {
      window.removeEventListener('atlas-messaging-updated', bump);
      window.removeEventListener('atlas-deleted-threads-changed', bump);
    };
  }, [queryClient]);

  const deletedIds = new Set(getDeletedIds());
  return computeInboxBadgeCount(threads, deletedIds);
}

export function computeInboxBadgeCount(threads, deletedIds = new Set()) {
  if (!Array.isArray(threads) || threads.length === 0) return 0;
  return threads.reduce((sum, thread) => {
    const clientId = thread?.client_id ?? thread?.id ?? null;
    if (clientId && deletedIds.has(clientId)) return sum;
    const unread = Number(thread?.unread_count ?? thread?.unreadCount ?? 0);
    if (!Number.isFinite(unread) || unread <= 0) return sum;
    return sum + unread;
  }, 0);
}
