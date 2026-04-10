/**
 * Subscribes to messaging tables so coach/client shells refresh unread counts immediately
 * (RLS limits events to rows the user can read — no filter needed).
 */
import { useEffect } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/roles';

function dispatchMessagingUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
  } catch (_) {}
}

/**
 * @param {{ userId: string | null | undefined, role: string | null | undefined }} args
 */
export function useMessagingInboxRealtimeBump({ userId, role }) {
  useEffect(() => {
    if (!hasSupabase || !userId) return undefined;
    const supabase = getSupabase();
    if (!supabase) return undefined;
    const r = normalizeRole(role);
    if (r !== 'coach' && r !== 'client') return undefined;

    const channel = supabase
      .channel(`inbox-bump-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_messages' },
        () => {
          dispatchMessagingUpdated();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_threads' },
        () => {
          dispatchMessagingUpdated();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [userId, role]);
}
