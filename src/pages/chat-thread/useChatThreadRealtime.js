import { useCallback, useEffect, useRef, useState } from 'react';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { isOptimisticMessageId, optimisticMatchesServerRow } from '@/pages/chat-thread/chatThreadModel';
import { isPersistedSupabaseThreadId } from '@/pages/chat-thread/chatThreadConstants';

const MERGE_DEBOUNCE_MS = 320;
const RECONNECT_DELAYS_MS = [3000, 10000, 30000];

/**
 * Supabase Realtime for `message_messages` + thread read cursors + typing broadcast.
 * Uses a ref for `data` so the channel is not torn down when the useData identity changes.
 */
export function useChatThreadRealtime({
  threadId,
  dataRef,
  isClientView,
  setLoadedMessages,
  setLocalMessages,
  setCurrentThread,
  scrollToBottom,
  setRemoteTyping,
  remoteTypingHideRef,
  realtimeChannelRef,
  channelSubscribedRef,
}) {
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const mergeDebounceTimerRef = useRef(null);
  const channelRef = useRef(null);
  const supabaseRef = useRef(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearMergeTimer = useCallback(() => {
    if (mergeDebounceTimerRef.current != null) {
      clearTimeout(mergeDebounceTimerRef.current);
      mergeDebounceTimerRef.current = null;
    }
  }, []);

  const mergeMessagesFromServer = useCallback(async () => {
    const tid = threadIdRef.current;
    if (!tid) return;
    const data = dataRef.current;
    const latest = await data.listMessages(tid).catch(() => []);
    const arr = Array.isArray(latest) ? latest : [];
    setLoadedMessages(arr);
    setLocalMessages((prev) => {
      const ids = new Set(arr.map((x) => x?.id).filter(Boolean));
      return prev.filter((m) => {
        if (ids.has(m.id)) return false;
        if (!isOptimisticMessageId(m?.id)) return true;
        return !arr.some((s) => optimisticMatchesServerRow(m, s));
      });
    });
    try {
      data.markThreadRead?.(tid);
    } catch (_) {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
    } catch (_) {
      /* ignore */
    }
    requestAnimationFrame(() => scrollToBottom(false));
  }, [dataRef, setLoadedMessages, setLocalMessages, scrollToBottom]);

  const scheduleMergeFromServer = useCallback(() => {
    clearMergeTimer();
    mergeDebounceTimerRef.current = setTimeout(() => {
      mergeDebounceTimerRef.current = null;
      void mergeMessagesFromServer();
    }, MERGE_DEBOUNCE_MS);
  }, [clearMergeTimer, mergeMessagesFromServer]);

  const teardownChannel = useCallback(() => {
    channelSubscribedRef.current = false;
    realtimeChannelRef.current = null;
    const channel = channelRef.current;
    const supabase = supabaseRef.current;
    channelRef.current = null;
    if (remoteTypingHideRef.current) clearTimeout(remoteTypingHideRef.current);
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    }
  }, [channelSubscribedRef, realtimeChannelRef, remoteTypingHideRef]);

  const scheduleReconnect = useCallback(() => {
    if (!threadIdRef.current) return;
    clearReconnectTimer();
    const idx = Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS_MS.length - 1);
    const delay = RECONNECT_DELAYS_MS[idx];
    reconnectAttemptRef.current += 1;
    setIsReconnecting(true);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      const channel = channelRef.current;
      if (channel) {
        try {
          channel.subscribe();
        } catch (_) {
          scheduleReconnect();
        }
      }
    }, delay);
  }, [clearReconnectTimer]);

  useEffect(() => {
    if (!threadId || !hasSupabase || !isPersistedSupabaseThreadId(threadId)) return undefined;
    const supabase = getSupabase();
    if (!supabase) return undefined;
    supabaseRef.current = supabase;
    const myRole = isClientView ? 'client' : 'coach';
    const channel = supabase.channel(`chat-live-${threadId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    realtimeChannelRef.current = channel;
    channelSubscribedRef.current = false;
    reconnectAttemptRef.current = 0;
    setIsReconnecting(false);

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.role === myRole) return;
        setRemoteTyping(true);
        if (remoteTypingHideRef.current) clearTimeout(remoteTypingHideRef.current);
        remoteTypingHideRef.current = setTimeout(() => setRemoteTyping(false), 2800);
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_messages', filter: `thread_id=eq.${threadId}` },
        () => {
          scheduleMergeFromServer();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_messages', filter: `thread_id=eq.${threadId}` },
        () => {
          scheduleMergeFromServer();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_threads', filter: `id=eq.${threadId}` },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
          setCurrentThread((prev) =>
            prev && prev.id === row.id
              ? {
                  ...prev,
                  coach_last_read_at: row.coach_last_read_at ?? prev.coach_last_read_at,
                  client_last_read_at: row.client_last_read_at ?? prev.client_last_read_at,
                  updated_at: row.updated_at ?? prev.updated_at,
                }
              : prev,
          );
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelSubscribedRef.current = true;
          reconnectAttemptRef.current = 0;
          setIsReconnecting(false);
          clearReconnectTimer();
          return;
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          channelSubscribedRef.current = false;
          scheduleReconnect();
        }
      });

    return () => {
      clearReconnectTimer();
      clearMergeTimer();
      setIsReconnecting(false);
      teardownChannel();
    };
  }, [
    threadId,
    isClientView,
    clearMergeTimer,
    clearReconnectTimer,
    scheduleMergeFromServer,
    scheduleReconnect,
    teardownChannel,
  ]);

  useEffect(() => {
    if (!threadId || !isPersistedSupabaseThreadId(threadId)) return undefined;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void mergeMessagesFromServer();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [threadId, mergeMessagesFromServer]);

  return { isReconnecting };
}
