import { useCallback, useEffect } from 'react';
import { useChatThreadRealtime } from '@/pages/chat-thread/useChatThreadRealtime';

export function useChatThreadRealtimeWiring({
  currentThreadId,
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
  conversationId,
  senderRole,
  lastMarkedReadThreadRef,
  markThreadRead,
  debugMessaging,
  queryClient,
  lastTypingBroadcastRef,
}) {
  const { isReconnecting } = useChatThreadRealtime({
    threadId: currentThreadId,
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
  });

  useEffect(() => {
    if (!conversationId || !senderRole) return;
    if (lastMarkedReadThreadRef.current === conversationId) return;
    lastMarkedReadThreadRef.current = conversationId;
    Promise.resolve(markThreadRead?.(conversationId)).then(() => {
      debugMessaging('markRead', { threadId: conversationId, asRole: senderRole });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    });
  }, [conversationId, senderRole, queryClient, markThreadRead, debugMessaging, lastMarkedReadThreadRef]);

  const pulseRemoteTypingIndicator = useCallback(() => {
    const ch = realtimeChannelRef.current;
    if (!ch || !channelSubscribedRef.current) return;
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current < 700) return;
    lastTypingBroadcastRef.current = now;
    void ch.send({
      type: 'broadcast',
      event: 'typing',
      payload: { role: isClientView ? 'client' : 'coach' },
    });
  }, [isClientView, realtimeChannelRef, channelSubscribedRef, lastTypingBroadcastRef]);

  return { isReconnecting, pulseRemoteTypingIndicator };
}

