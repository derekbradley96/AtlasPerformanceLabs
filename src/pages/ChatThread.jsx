/**
 * ChatThread – chat UI with Call/Video actions and coach Context panel.
 * Scrollable message list, bubbles left/right, timestamps grouped, empty state, composer.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { MessageCircle } from 'lucide-react';
import { trackFriction, trackRecoverableError } from '@/services/frictionTracker';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { navigateToThread } from '@/lib/messagesPath';
import { atlasMigrationDataAttributes, deriveMessagesThreadRouteState } from '@/lib/atlasMigrationPhases';
import { formatReplyBubblePreview, formatReplyComposerLabel } from '@/pages/chat-thread/chatThreadModel';
import { getClientRiskEvaluation } from '@/lib/riskService';
import { getChatContextSnapshot } from '@/lib/chatContextSnapshot';
import { getCoachPrepNotes, setCoachPrepNotes } from '@/lib/coachPrepNotesStore';
import { safeDate } from '@/lib/format';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useChatScrollState } from '@/components/app/useChatScrollState';
import MessageActionSheet from '@/components/messages/MessageActionSheet';
import { compressImage } from '@/lib/messaging/messageMediaStorage';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  deleteMessage as deleteSupabaseMessage,
  updateMessageText as updateSupabaseMessageText,
} from '@/lib/messaging/supabaseMessaging';
import {
  canReplyToMessage,
  getMessageMenuCapabilities,
} from '@/lib/messaging/messageInteractionRules';
import { usePresentationMode } from '@/lib/presentationMode';
import { insertOutgoingVideoCall } from '@/lib/callRequestState';
import CallPrepSheet from '@/components/chat/CallPrepSheet';
import AtlasVideoCall from '@/components/video/AtlasVideoCall';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/skeleton';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ChatThreadComposer from '@/pages/chat-thread/ChatThreadComposer';
import ChatThreadCallControls from '@/pages/chat-thread/ChatThreadCallControls';
import ChatThreadMessageList from '@/pages/chat-thread/ChatThreadMessageList';
import ChatThreadOverlays from '@/pages/chat-thread/ChatThreadOverlays';
import { resolveMessagingThreadId } from '@/pages/chat-thread/resolveMessagingThreadId';
import { useChatThreadRealtimeWiring } from '@/pages/chat-thread/useChatThreadRealtimeWiring';
import {
  MAX_VIDEO_UPLOAD_BYTES,
  MEDIA_LONG_PRESS_MS,
  READ_RECEIPT_TIME_SLACK_MS,
  formatMessageTimestamp,
  heavyHaptic,
  lightHaptic,
  revokeBlobUrl,
} from '@/pages/chat-thread/chatThreadUiPrimitives';
import { formatMessagingError } from '@/lib/messaging/formatMessagingError';
import { toast } from 'sonner';

import { colors, spacing } from '@/ui/tokens';
const BG = colors.bg;
const ACCENT = colors.primary;
const MUTED = colors.muted;
const BORDER = colors.border;
const AUTO_SCROLL_THRESHOLD = 200;
/** Composer bar height (padding + input row) for thread padding-bottom. */
const COMPOSER_HEIGHT = 72;
const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';
const QUICK_REPLIES = ['Got it!', 'On it', 'Send when you can', 'Sounds good'];
const DEBUG_MESSAGING = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MESSAGING === 'true';
const DESKTOP_SIDEBAR_WIDTH = 232;


export default function ChatThread() {
  const { clientId } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const data = useData();
  const { user, effectiveRole, clientLinkedRow, profile } = useAuth();
  const role = normalizeRole(effectiveRole ?? user?.role ?? null);
  const isCoachRole = role === 'coach';
  const callRole = isCoachRole ? 'caller' : 'callee';
  const isClientView = role === 'client';
  const outgoingSenderKey = isClientView ? 'client' : 'coach';
  const senderRole = isClientView ? 'client' : 'coach';
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const coachIdFromClientContext =
    clientLinkedRow?.coach_id ??
    clientLinkedRow?.trainer_id ??
    profile?.coach_id ??
    profile?.trainer_id ??
    null;
  const coachId = isClientView ? coachIdFromClientContext : user?.id ?? null;
  const routeClientRosterId = clientId ?? null;
  const authClientRosterId = clientLinkedRow?.id ?? null;
  const resolvedClientRosterId = isClientView ? authClientRosterId : routeClientRosterId;
  const { isDesktopWeb } = usePresentationMode();

  const debugMessaging = useCallback((event, payload = {}) => {
    if (!DEBUG_MESSAGING) return;
    try {
      console.info(`[chat-thread:${event}]`, payload);
    } catch {}
  }, []);
  const { setHeaderTitle, setHeaderRight } = useOutletContext() || {};
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const [loadedClient, setLoadedClient] = useState(null);
  const [clientResolved, setClientResolved] = useState(false);
  const [loadedMessages, setLoadedMessages] = useState([]);
  const [currentThread, setCurrentThread] = useState(null);
  const [callPrepOpen, setCallPrepOpen] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [activeCallRequestId, setActiveCallRequestId] = useState(null);
  const [prepNotes, setPrepNotesState] = useState('');
  const [conversationDeleted, setConversationDeleted] = useState(false);
  const [menuMessage, setMenuMessage] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  useEffect(() => {
    if (!isClientView) return;
    if (!routeClientRosterId || !authClientRosterId) return;
    if (routeClientRosterId === authClientRosterId) return;
    navigateToThread(navigate, authClientRosterId, { replace: true });
  }, [isClientView, routeClientRosterId, authClientRosterId, navigate]);

  const { data: conversation } = useQuery({
    queryKey: ['conversation', role, coachId, resolvedClientRosterId],
    queryFn: () => {
      if (!resolvedClientRosterId) return null;
      return isClientView
        ? (typeof data.ensureConversation === 'function'
          ? data.ensureConversation(resolvedClientRosterId)
          : data.getThread(resolvedClientRosterId))
        : data.ensureThreadForClient(resolvedClientRosterId);
    },
    enabled: Boolean(resolvedClientRosterId && (isClientView || coachId)),
    staleTime: 0,
    retry: false,
  });
  const conversationId = conversation?.id ?? null;

  const { data: clientCheckinsFromQuery = [] } = useQuery({
    queryKey: ['chat-client-checkins', clientId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !clientId) return [];
      const { data } = await sb
        .from('checkins')
        .select('id, submitted_at, status, coach_reviewed_at')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: Boolean(clientId && hasSupabase && !isClientView),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dbMessages = [] } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => data.listMessages(conversationId),
    enabled: Boolean(conversationId),
    staleTime: 0,
  });

  const { data: latestCallRequest = null } = useQuery({
    queryKey: ['chat-latest-call-request', resolvedClientRosterId, coachId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !resolvedClientRosterId || !coachId) return null;
      const { data: row, error } = await sb
        .from('checkin_call_requests')
        .select('id, checkin_id, call_type, status, proposed_at, agenda, updated_at, created_at')
        .eq('client_id', resolvedClientRosterId)
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return row ?? null;
    },
    enabled: Boolean(supabase && resolvedClientRosterId && coachId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!clientId) {
      setLoadedClient(null);
      setClientResolved(true);
      setLoadedMessages([]);
      setCurrentThread(null);
      setConversationDeleted(false);
      return;
    }
    if (isClientView && !resolvedClientRosterId) {
      const fallbackName = profile?.coach_name || 'Your coach';
      setLoadedClient({
        id: clientId,
        full_name: fallbackName,
        name: fallbackName,
      });
      setLoadedMessages([]);
      setCurrentThread(null);
      setConversationDeleted(false);
      setClientResolved(true);
      return;
    }
    setClientResolved(false);
    setConversationDeleted(false);
    setCurrentThread(null);
    let cancelled = false;

    const loadConversation = async () => {
      let rosterClient = null;
      if (isClientView) {
        const fallbackName = profile?.coach_name || 'Your coach';
        rosterClient = {
          id: resolvedClientRosterId ?? clientId,
          full_name: fallbackName,
          name: fallbackName,
        };
      } else if (typeof data?.getClient === 'function') {
        try {
          rosterClient = await data.getClient(clientId);
        } catch {
          rosterClient = null;
        }
      }

      let thread = conversation ?? null;
      if (!thread) {
        try {
          thread = isClientView
            ? await (typeof data?.ensureConversation === 'function'
              ? data.ensureConversation(resolvedClientRosterId)
              : typeof data?.getThread === 'function'
                ? data.getThread(resolvedClientRosterId)
                : null)
            : typeof data?.ensureThreadForClient === 'function'
              ? await data.ensureThreadForClient(resolvedClientRosterId)
              : await data.getThread?.(resolvedClientRosterId) ?? null;
        } catch (threadErr) {
          if (import.meta.env?.DEV) console.error('[ChatThread] loadConversation thread failed', threadErr);
          if (!cancelled) {
            setClientResolved(true);
          }
          return;
        }
      }

      if (cancelled) return;

      const navClientName = (location.state?.clientName ?? '').toString().trim();
      if (!rosterClient && thread) {
        rosterClient = {
          id: clientId,
          full_name: navClientName || 'Client',
          name: navClientName || 'Client',
        };
      }

      setLoadedClient(rosterClient);

      if (!thread) {
        setConversationDeleted(false);
        setLoadedMessages([]);
        setClientResolved(true);
        return;
      }

      setConversationDeleted(false);
      setCurrentThread(thread);
      const threadId = thread?.id ?? clientId;
      const fromData = supabase && conversation?.id
        ? dbMessages
        : await data.listMessages(threadId).catch(() => []);
      if (cancelled) return;
      const list = Array.isArray(fromData) ? fromData : [];
      setLoadedMessages(list);
      setClientResolved(true);
      data.markThreadRead?.(threadId);
    };

    void loadConversation();
    return () => { cancelled = true; };
  }, [
    clientId,
    data,
    isClientView,
    clientLinkedRow?.id,
    profile?.full_name,
    profile?.name,
    conversation,
    dbMessages,
    supabase,
    routeClientRosterId,
    resolvedClientRosterId,
    location.state?.clientName,
    profile?.coach_name,
  ]);

  useEffect(() => {
    const prefilled = location.state?.prefilledMessage;
    const pendingId = location.state?.pendingMessageId;
    if (pendingId) pendingCoachMessageIdRef.current = pendingId;
    if (prefilled) {
      setInput(String(prefilled));
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    const reminder = searchParams.get('reminder');
    if (reminder === 'payment') {
      setInput(PAYMENT_REMINDER_MSG);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('reminder');
        return p;
      }, { replace: true });
    }
  }, [location.pathname, location.state?.prefilledMessage, location.state?.pendingMessageId, navigate, searchParams, setSearchParams]);

  const [localMessages, setLocalMessages] = useState([]);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  /** Other party is typing (Supabase Realtime broadcast). */
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(() => new Set());
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const fileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const [isSending, setIsSending] = useState(false);
  const statusTimersRef = useRef([]);
  const realtimeChannelRef = useRef(null);
  const channelSubscribedRef = useRef(false);
  const remoteTypingHideRef = useRef(null);
  const lastTypingBroadcastRef = useRef(0);
  const dataRef = useRef(data);
  /** When set, first successful coach text send marks this pending_coach_messages row approved/sent. */
  const pendingCoachMessageIdRef = useRef(null);
  const atBottomRef = useRef(true);
  const mediaLongPressTimeoutRef = useRef(null);
  const lastMarkedReadThreadRef = useRef(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const { keyboardInset } = useKeyboardInset();
  const { atBottom, showJump, newCount, smoothJumpToBottom } =
    useChatScrollState(messagesRef, AUTO_SCROLL_THRESHOLD);
  atBottomRef.current = atBottom;

  const resolveActiveThreadId = useCallback(
    () =>
      resolveMessagingThreadId({
        currentThread,
        conversationId,
        clientId: resolvedClientRosterId,
        data,
        isClientView,
        onThreadResolved: setCurrentThread,
      }),
    [currentThread, conversationId, resolvedClientRosterId, data, isClientView],
  );

  const client = loadedClient;
  const showNotFound = clientId && clientResolved && !client && !currentThread && !conversation;

  const seedList = Array.isArray(loadedMessages) ? loadedMessages : [];
  const localList = Array.isArray(localMessages) ? localMessages : [];
  const allMessages = useMemo(() => {
    const merged = [...seedList, ...localList];
    const byId = new Map();
    for (const m of merged) {
      if (m?.id == null) continue;
      const cur = byId.get(m.id);
      if (!cur) {
        byId.set(m.id, m);
        continue;
      }
      const pick =
        (cur.status === 'sending' || cur.status === 'sent') && !(m.status === 'sending' || m.status === 'sent')
          ? cur
          : m.status && !cur.status
            ? m
            : cur;
      byId.set(m.id, pick);
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ta = safeDate(a?.created_date)?.getTime() ?? 0;
      const tb = safeDate(b?.created_date)?.getTime() ?? 0;
      return ta - tb;
    });
  }, [seedList, localList]);
  const outgoing = allMessages.filter((m) =>
    isClientView ? m?.sender === 'client' : m?.sender === 'coach' || m?.sender === 'trainer'
  );
  const lastOutgoingMessage = outgoing.length ? outgoing[outgoing.length - 1] : null;
  const persistedSupabaseThread = useMemo(() => {
    if (!hasSupabase || !currentThread?.id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(currentThread.id));
  }, [currentThread?.id]);
  /** Delivered/read under last bubble: DB read cursors for Supabase; local simulation for sandbox. */
  const lastOutgoingDelivery = useMemo(() => {
    const m = lastOutgoingMessage;
    if (!m?.id) return { status: null, readAt: null };
    if (m.status === 'sending' || m.status === 'sent') {
      return { status: m.status, readAt: null };
    }
    if (persistedSupabaseThread) {
      const msgMs = safeDate(m.created_date)?.getTime();
      if (msgMs != null && !Number.isNaN(msgMs)) {
        if (isClientView) {
          const coachRead = currentThread?.coach_last_read_at
            ? new Date(currentThread.coach_last_read_at).getTime()
            : NaN;
          if (!Number.isNaN(coachRead) && coachRead >= msgMs - READ_RECEIPT_TIME_SLACK_MS) {
            return { status: 'read', readAt: currentThread.coach_last_read_at };
          }
        } else {
          const clientRead = currentThread?.client_last_read_at
            ? new Date(currentThread.client_last_read_at).getTime()
            : NaN;
          if (!Number.isNaN(clientRead) && clientRead >= msgMs - READ_RECEIPT_TIME_SLACK_MS) {
            return { status: 'read', readAt: currentThread.client_last_read_at };
          }
        }
        return { status: 'delivered', readAt: null };
      }
    }
    if (m.status === 'read' || m.status === 'delivered') {
      return { status: m.status, readAt: m.readAt ?? null };
    }
    if (m.status) return { status: m.status, readAt: m.readAt ?? null };
    return { status: null, readAt: null };
  }, [lastOutgoingMessage, currentThread, isClientView, persistedSupabaseThread]);
  const replyPreviewById = useMemo(() => {
    const byId = new Map(allMessages.map((msg) => [msg?.id, msg]));
    const result = new Map();
    allMessages.forEach((msg) => {
      if (!msg?.id) return;
      const fromDb = formatReplyBubblePreview(msg);
      if (fromDb) {
        result.set(msg.id, fromDb);
        return;
      }
      const source = byId.get(msg?.reply_to_id);
      if (!source) return;
      const body = String(source?.body || '').trim();
      if (body) {
        result.set(msg.id, body.length > 70 ? `${body.slice(0, 70)}...` : body);
        return;
      }
      const label = formatReplyComposerLabel(source);
      if (label && label !== 'message') result.set(msg.id, label);
    });
    return result;
  }, [allMessages]);

  const openMessageMenu = useCallback((message, event) => {
    setMenuMessage(message);
    if (event?.clientX != null && event?.clientY != null) {
      setMenuAnchor({ x: event.clientX, y: event.clientY });
    } else {
      setMenuAnchor(null);
    }
  }, []);

  const menuCapabilities = useMemo(() => {
    if (!menuMessage) return null;
    return getMessageMenuCapabilities(menuMessage, currentThread, isClientView);
  }, [menuMessage, currentThread, isClientView]);

  const startMediaLongPress = useCallback((message) => {
    if (mediaLongPressTimeoutRef.current) clearTimeout(mediaLongPressTimeoutRef.current);
    mediaLongPressTimeoutRef.current = setTimeout(() => {
      openMessageMenu(message, null);
    }, MEDIA_LONG_PRESS_MS);
  }, [openMessageMenu]);

  const cancelMediaLongPress = useCallback(() => {
    if (mediaLongPressTimeoutRef.current) {
      clearTimeout(mediaLongPressTimeoutRef.current);
      mediaLongPressTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLocalMessages([]);
    setReplyTo(null);
    setMenuMessage(null);
    setRemoteTyping(false);
    statusTimersRef.current.forEach(clearTimeout);
    statusTimersRef.current = [];
    if (remoteTypingHideRef.current) clearTimeout(remoteTypingHideRef.current);
  }, [clientId]);

  useEffect(() => () => cancelMediaLongPress(), [cancelMediaLongPress]);

  /** Sandbox / non-Supabase: fake “read” when scrolled to bottom (not used for real DB threads). */
  useEffect(() => {
    if (!atBottom || persistedSupabaseThread) return;
    setLocalMessages((prev) =>
      prev.map((m) => {
        const isOut = isClientView ? m?.sender === 'client' : m?.sender === 'coach' || m?.sender === 'trainer';
        if (!isOut || m?.status !== 'delivered') return m;
        return { ...m, status: 'read', readAt: m.readAt ?? Date.now() };
      })
    );
  }, [atBottom, isClientView, persistedSupabaseThread]);

  useEffect(() => {
    if (typeof setHeaderTitle !== 'function') return undefined;
    const otherPartyName = isClientView ? 'Your coach' : (client?.full_name || 'Chat');
    const otherPartyAvatar = isClientView
      ? null
      : (client?.profiles?.avatar_url ?? client?.avatar_url ?? null);
    const initials = String(otherPartyName || '?')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
    const headerNode = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          color: colors.text,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.muted,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {otherPartyAvatar ? (
            <img
              src={otherPartyAvatar}
              alt={otherPartyName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : initials}
        </div>
        <span style={{ fontSize: 17, fontWeight: 600, color: colors.text }}>
          {otherPartyName}
        </span>
      </div>
    );
    if (isClientView) {
      setHeaderTitle(headerNode);
      return () => setHeaderTitle(null);
    }
    setHeaderTitle(headerNode);
    return () => setHeaderTitle(null);
  }, [client, setHeaderTitle, isClientView]);

  useEffect(() => {
    setPrepNotesState(clientId ? getCoachPrepNotes(clientId) : '');
  }, [clientId]);

  const contextSnapshot = useMemo(
    () =>
      clientId
        ? getChatContextSnapshot(clientId, {
            getClientById: (id) => (id === clientId ? client : null),
            getClientCheckIns: (id) => (id === clientId ? (clientCheckinsFromQuery ?? []) : []),
            getClientRiskEvaluation: (id) =>
              getClientRiskEvaluation(id, { client: id === clientId ? client : undefined }),
          })
        : { wins: [], slips: [], flags: [], checkInDue: null, lastCheckIn: null },
    [clientId, client, clientCheckinsFromQuery]
  );

  const openAcceptedCall = useCallback(() => {
    if (!latestCallRequest) return false;
    if (latestCallRequest.status !== 'accepted') return false;
    if (latestCallRequest.call_type !== 'video') return false;
    setActiveCallRequestId(latestCallRequest.id);
    setCallActive(true);
    return true;
  }, [latestCallRequest]);

  const startChatVideoCall = useCallback(async () => {
    if (isClientView) return false;
    if (!supabase || !resolvedClientRosterId || !coachId) {
      toast.error('Missing call context.');
      return false;
    }
    let inserted = null;
    try {
      inserted = await insertOutgoingVideoCall({
        supabase,
        coachId,
        clientId: resolvedClientRosterId,
        callerName: profile?.display_name ?? user?.full_name ?? 'Coach',
      });
    } catch (error) {
      toast.error(String(error?.message || 'Could not start call from chat.'));
      return false;
    }
    if (!inserted?.id) return false;
    queryClient.invalidateQueries({ queryKey: ['chat-latest-call-request', resolvedClientRosterId, coachId] });
    setActiveCallRequestId(inserted.id);
    setCallActive(true);
    return true;
  }, [
    isClientView,
    supabase,
    resolvedClientRosterId,
    coachId,
    profile?.display_name,
    user?.full_name,
    queryClient,
  ]);

  const handlePrepAudioStart = useCallback(() => {
    if (latestCallRequest?.status === 'accepted' && latestCallRequest?.call_type === 'phone') {
      toast.message('Phone call accepted. Start from your phone now.');
      return true;
    }
    return false;
  }, [latestCallRequest]);

  const handlePrepVideoStart = useCallback(async () => {
    const started = openAcceptedCall();
    if (started) return true;
    return startChatVideoCall();
  }, [openAcceptedCall, startChatVideoCall]);

  const handlePrepNotesChange = useCallback(
    (text) => {
      setPrepNotesState(text ?? '');
      if (clientId) setCoachPrepNotes(clientId, text ?? '');
    },
    [clientId]
  );

  const handleSendSummaryCard = useCallback(
    async (payload) => {
      if (!payload || !clientId || isClientView) return;
      const created_date = new Date().toISOString();
      const bodyText = [payload.title, (payload.wins ?? []).join(' · '), (payload.nextSteps ?? []).join(' ')].filter(Boolean).join('\n');
      const newMsg = {
        id: `local-summary-${Date.now()}`,
        client_id: clientId,
        sender: 'coach',
        body: bodyText,
        created_date,
        status: 'sending',
        type: 'summary_card',
        summaryPayload: payload,
      };
      setLocalMessages((prev) => [...prev, newMsg]);
      const threadId = await resolveActiveThreadId();
      if (threadId) {
        const added = await data.sendMessage(threadId, bodyText);
        if (added) {
          setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, id: added.id, status: 'sent', summaryPayload: payload } : m)));
        }
      }
      toast.success('Summary sent to chat');
    },
    [clientId, data, isClientView, resolveActiveThreadId]
  );

  const scrollToBottom = useCallback((force) => {
    const el = messagesRef.current;
    if (!el) return;
    if (!force) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < AUTO_SCROLL_THRESHOLD;
      if (!nearBottom) return;
    }
    el.scrollTop = el.scrollHeight;
  }, []);

  const retryFailedMessage = useCallback(
    async (message) => {
      if (!message?.id || message?.status !== 'failed') return;
      const threadId = await resolveActiveThreadId();
      if (!threadId) return;
      setLocalMessages((prev) => prev.map((m) => (m?.id === message.id ? { ...m, status: 'sending' } : m)));
      try {
        if (message?.type === 'image' || message?.type === 'gif' || message?.type === 'video') {
          const mediaUrl = message?.media_url;
          if (!mediaUrl) throw new Error('Missing media');
          const response = await fetch(mediaUrl);
          const blob = await response.blob();
          const mimeType = message?.type === 'gif'
            ? 'image/gif'
            : message?.type === 'video'
              ? (blob?.type || 'video/mp4')
              : (blob?.type || 'image/jpeg');
          const added = await data.sendMessage(threadId, {
            type: message.type,
            blob,
            mimeType,
            text: '',
            fileName: message.type === 'gif' ? 'gif.gif' : message.type === 'video' ? 'video.mp4' : 'image.jpg',
          }, { rosterClientId: resolvedClientRosterId });
          setLocalMessages((prev) =>
            prev.map((m) =>
              m?.id === message.id
                ? {
                    ...m,
                    id: added?.id ?? m.id,
                    media_url: added?.media_url || m.media_url,
                    status: 'delivered',
                  }
                : m
            )
          );
          requestAnimationFrame(() => scrollToBottom(true));
          return;
        }
        const textBody = String(message?.body ?? '').trim();
        if (!textBody) throw new Error('Message body missing');
        const added = await data.sendMessage(threadId, textBody, {
          rosterClientId: resolvedClientRosterId,
        });
        setLocalMessages((prev) =>
          prev.map((m) =>
            m?.id === message.id
              ? { ...m, id: added?.id ?? m.id, status: 'delivered', deliveredAt: Date.now() }
              : m
          )
        );
        requestAnimationFrame(() => scrollToBottom(true));
      } catch (err) {
        setLocalMessages((prev) => prev.map((m) => (m?.id === message.id ? { ...m, status: 'failed' } : m)));
        const errMsg = formatMessagingError(err);
        if (import.meta.env?.DEV) console.error('[ChatThread] retryFailedMessage failed', err);
        toast.error(import.meta.env.DEV ? errMsg : 'Retry failed. Check your connection and try again.');
      }
    },
    [clientId, data, scrollToBottom, resolveActiveThreadId, resolvedClientRosterId, formatMessagingError]
  );

  const patchMessageById = useCallback((messageId, patch) => {
    const apply = (m) => (m?.id === messageId ? { ...m, ...patch } : m);
    setLocalMessages((prev) => prev.map(apply));
    setLoadedMessages((prev) => (Array.isArray(prev) ? prev.map(apply) : prev));
  }, []);

  const saveEditedMessage = useCallback(
    async (text) => {
      const t = String(text ?? '').trim();
      if (!t || !editingMessage?.id) return;
      setIsSending(true);
      try {
        if (supabase && hasSupabase) {
          await updateSupabaseMessageText({ supabase, messageId: editingMessage.id, text: t });
        }
        patchMessageById(editingMessage.id, { body: t, edited: true });
        setEditingMessage(null);
        setInput('');
        toast.success('Message updated');
      } catch (err) {
        toast.error(import.meta.env.DEV ? formatMessagingError(err) : 'Could not update message');
      } finally {
        setIsSending(false);
      }
    },
    [editingMessage, supabase, patchMessageById],
  );

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const sendChatMedia = useCallback(
    async ({ type, blob, mimeType, fileName, previewUrl, failLabel }) => {
      if (!blob || !resolvedClientRosterId) return;
      const localId = `local-${type}-${Date.now()}`;
      const created_date = new Date().toISOString();
      setLocalMessages((prev) => [
        ...prev,
        {
          id: localId,
          client_id: clientId,
          sender: outgoingSenderKey,
          type,
          media_url: previewUrl,
          body: '',
          created_date,
          status: 'sending',
        },
      ]);
      requestAnimationFrame(() => scrollToBottom(true));
      try {
        const threadId = await resolveActiveThreadId();
        if (!threadId) throw new Error('Could not open conversation');
        const added = await data.sendMessage(
          threadId,
          { type, blob, mimeType, text: '', fileName },
          { rosterClientId: resolvedClientRosterId },
        );
        if (!added?.id) throw new Error(`${failLabel} could not be sent`);
        setLocalMessages((prev) =>
          prev.map((m) => {
            if (m?.id !== localId) return m;
            const keepPreview =
              m.media_url && String(m.media_url).startsWith('blob:')
                ? m.media_url
                : added.media_url || m.media_url;
            return { ...m, id: added.id, media_url: keepPreview, status: 'delivered' };
          }),
        );
        queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
        queryClient.invalidateQueries({ queryKey: ['threads'] });
        requestAnimationFrame(() => scrollToBottom(true));
      } catch (err) {
        revokeBlobUrl(previewUrl);
        setLocalMessages((prev) => prev.map((m) => (m?.id === localId ? { ...m, status: 'failed' } : m)));
        if (import.meta.env?.DEV) console.error(`[ChatThread] send ${type} failed`, err);
        toast.error(import.meta.env.DEV ? formatMessagingError(err) : `Failed to send ${failLabel.toLowerCase()}`);
      }
    },
    [
      clientId,
      data,
      outgoingSenderKey,
      resolveActiveThreadId,
      resolvedClientRosterId,
      scrollToBottom,
      queryClient,
    ],
  );

  const handleImageSelected = useCallback(
    async (event) => {
      const file = event.target?.files?.[0];
      if (!file || !clientId) return;
      event.target.value = '';
      setIsSending(true);
      let previewUrl = null;
      try {
        const compressed = await compressImage(file);
        previewUrl = URL.createObjectURL(compressed);
        await sendChatMedia({
          type: 'image',
          blob: compressed,
          mimeType: compressed.type || 'image/jpeg',
          fileName: file.name || 'image.jpg',
          previewUrl,
          failLabel: 'Photo',
        });
      } catch {
        revokeBlobUrl(previewUrl);
      } finally {
        setIsSending(false);
      }
    },
    [clientId, sendChatMedia],
  );

  const handleVideoSelected = useCallback(
    async (event) => {
      const file = event.target?.files?.[0];
      if (!file || !clientId) return;
      event.target.value = '';
      if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
        toast.error('Video is too large. Try a clip under 40 MB.');
        return;
      }
      setIsSending(true);
      let previewUrl = null;
      try {
        previewUrl = URL.createObjectURL(file);
        await sendChatMedia({
          type: 'video',
          blob: file,
          mimeType: file.type || 'video/mp4',
          fileName: file.name || 'video.mp4',
          previewUrl,
          failLabel: 'Video',
        });
      } catch {
        revokeBlobUrl(previewUrl);
      } finally {
        setIsSending(false);
      }
    },
    [clientId, sendChatMedia],
  );

  const handleSendGif = useCallback(
    async (gifUrl) => {
      if (!gifUrl || !clientId) return;
      setShowGifPicker(false);
      setIsSending(true);
      try {
        const response = await fetch(gifUrl);
        const blob = await response.blob();
        await sendChatMedia({
          type: 'gif',
          blob,
          mimeType: 'image/gif',
          fileName: 'gif.gif',
          previewUrl: gifUrl,
          failLabel: 'GIF',
        });
      } catch {
        /* sendChatMedia surfaces toast */
      } finally {
        setIsSending(false);
      }
    },
    [clientId, sendChatMedia],
  );

  const { isReconnecting, pulseRemoteTypingIndicator } = useChatThreadRealtimeWiring({
    currentThreadId: currentThread?.id,
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
    markThreadRead: data.markThreadRead,
    debugMessaging,
    queryClient,
    lastTypingBroadcastRef,
  });

  useEffect(() => {
    if (keyboardInset <= 0) return;
    requestAnimationFrame(() => scrollToBottom(true));
  }, [keyboardInset, scrollToBottom]);

  const sendText = useCallback(
    async (textToSend) => {
      const t = (textToSend ?? '').trim();
      if (!t) return;
      lightHaptic();
      setIsSending(true);

      if (editingMessage?.id) {
        await saveEditedMessage(t);
        return;
      }

      const created_date = new Date().toISOString();
      const replyToId =
        replyTo?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(replyTo.id))
          ? replyTo.id
          : null;
      const replyToMessageSnapshot = replyTo
        ? {
            id: replyTo.id,
            message_text: replyTo.body ?? '',
            sender_role: replyTo.sender === 'client' ? 'client' : 'coach',
            message_type: replyTo.type ?? 'text',
          }
        : null;
      const newMsg = {
        id: `local-${Date.now()}`,
        client_id: clientId,
        sender: outgoingSenderKey,
        body: t,
        created_date,
        status: 'sending',
        ...(replyToId && {
          reply_to_id: replyToId,
          reply_to_message: replyToMessageSnapshot,
        }),
      };
      setNewMessageIds((prev) => new Set([...prev, newMsg.id]));
      setLocalMessages((prev) => [...prev, newMsg]);
      setInput('');
      try {
        const threadId = await resolveActiveThreadId();
        if (!threadId) {
          setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, status: 'failed' } : m)));
          toast.error('Could not start conversation');
          setIsSending(false);
          return;
        }
        const added = await data.sendMessage(threadId, t, {
          replyToId,
          rosterClientId: resolvedClientRosterId,
        });
        debugMessaging('sendComposer.success', {
          threadId,
          localId: newMsg.id,
          messageId: added?.id ?? null,
          senderRole,
        });
        setLocalMessages((prev) =>
          prev.map((m) =>
            m?.id === newMsg.id
              ? {
                  ...m,
                  id: added?.id ?? m.id,
                  status: 'delivered',
                  deliveredAt: Date.now(),
                  reply_to_id: replyToId,
                  reply_to_message: replyToMessageSnapshot,
                }
              : m
          )
        );
        setReplyTo(null);
      } catch (err) {
        debugMessaging('sendComposer.error', { localId: newMsg.id, senderRole });
        trackFriction('message_send_failed', { threadId: currentThread?.id ?? clientId, clientId });
        trackRecoverableError('ChatThread', 'sendMessage', err);
        setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, status: 'failed' } : m)));
        toast.error('Failed to send message');
      } finally {
        setIsSending(false);
      }
      requestAnimationFrame(() => scrollToBottom(true));
    },
    [
      clientId,
      data,
      scrollToBottom,
      replyTo,
      outgoingSenderKey,
      debugMessaging,
      senderRole,
      resolveActiveThreadId,
      editingMessage,
      saveEditedMessage,
      resolvedClientRosterId,
    ]
  );

  const handleSendVoice = useCallback(
    async ({ audioKey, mimeType, durationMs, blob }) => {
      if ((!audioKey && !blob) || !clientId) return;
      lightHaptic();
      const created_date = new Date().toISOString();
      const threadId = await resolveActiveThreadId();
      if (!threadId) {
        toast.error('Could not start conversation');
        return;
      }
      const replyToId =
        replyTo?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(replyTo.id))
          ? replyTo.id
          : null;
      const replyToMessageSnapshot = replyTo
        ? {
            id: replyTo.id,
            message_text: replyTo.body ?? '',
            sender_role: replyTo.sender === 'client' ? 'client' : 'coach',
            message_type: replyTo.type ?? 'text',
          }
        : null;
      const newMsg = {
        id: `voice-${Date.now()}`,
        client_id: clientId,
        sender: outgoingSenderKey,
        type: 'voice',
        audioKey: audioKey || null,
        mimeType: mimeType || 'audio/webm',
        durationMs: durationMs || 0,
        created_date,
        ...(replyToId && {
          reply_to_id: replyToId,
          reply_to_message: replyToMessageSnapshot,
        }),
      };
      setLocalMessages((prev) => [...prev, newMsg]);
      requestAnimationFrame(() => scrollToBottom(true));
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadId));
        if (typeof data?.sendVoiceMessage === 'function' && isUuid && blob) {
          const added = await data.sendVoiceMessage(threadId, {
            blob,
            mimeType: mimeType || 'audio/webm',
            durationMs: durationMs || 0,
          }, { replyToId });
          if (added) {
            setLocalMessages((prev) =>
              prev.map((m) =>
                m?.id === newMsg.id
                  ? {
                      ...m,
                      id: added.id,
                      media_url: added.media_url,
                      durationMs: added.durationMs || durationMs || 0,
                    reply_to_id: replyToId,
                    reply_to_message: replyToMessageSnapshot,
                    }
                  : m
              )
            );
            setReplyTo(null);
            return;
          }
        }
        // No local messageStore fallback: keep optimistic bubble if voice upload path is unavailable.
      } catch {
        toast.error('Failed to send voice note');
      }
    },
    [clientId, currentThread, data, scrollToBottom, outgoingSenderKey, replyTo]
  );

  const handleEdit = useCallback((message) => {
    if (!message?.id) return;
    setEditingMessage(message);
    setReplyTo(null);
    setInput(String(message.body ?? ''));
    setMenuMessage(null);
    setMenuAnchor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleCopy = useCallback(async (message) => {
    const text = message?.body ?? '';
    if (!text) {
      setMenuMessage(null);
      return;
    }
    try {
      if (Capacitor.isNativePlatform?.()) {
        const { Clipboard } = await import('@capacitor/clipboard');
        await Clipboard.write({ string: text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        toast.error('Copy not available');
        setMenuMessage(null);
        return;
      }
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
    setMenuMessage(null);
  }, []);

  const handleReply = useCallback((message) => {
    if (!canReplyToMessage(message)) {
      toast.error('Reply unavailable until the message is sent');
      setMenuMessage(null);
      setMenuAnchor(null);
      return;
    }
    setEditingMessage(null);
    setReplyTo(message ?? null);
    setMenuMessage(null);
    setMenuAnchor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleDelete = useCallback((message) => {
    const caps = getMessageMenuCapabilities(message, currentThread, isClientView);
    if (!message?.id || !caps.canDelete) return;
    setPendingDeleteMessage(message);
    setMenuMessage(null);
    setMenuAnchor(null);
  }, [currentThread, isClientView]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteMessage) return;
    heavyHaptic();
    if (supabase && conversationId) {
      await deleteSupabaseMessage(supabase, pendingDeleteMessage.id);
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    }
    setLocalMessages((prev) => prev.filter((m) => m?.id !== pendingDeleteMessage.id));
    setLoadedMessages((prev) => (Array.isArray(prev) ? prev.filter((m) => m?.id !== pendingDeleteMessage.id) : []));
    setPendingDeleteMessage(null);
  }, [pendingDeleteMessage, supabase, conversationId, queryClient]);

  const handleSwipeReply = useCallback((message) => {
    if (!canReplyToMessage(message)) {
      toast.error('Reply unavailable until the message is sent');
      return;
    }
    setEditingMessage(null);
    setReplyTo(message ?? null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleRequestCheckIn = useCallback(() => {
    toast.info('Check-in request sent');
    if (clientId) navigate(`/clients/${clientId}?tab=checkins`);
  }, [clientId, navigate]);

  const handleViewClient = useCallback(() => {
    if (clientId) navigate(`/clients/${clientId}`);
  }, [clientId, navigate]);

  const handlePaymentReminder = useCallback(() => {
    toast.info('Payment reminder sent');
    if (clientId) navigate(`/earnings?clientId=${clientId}`);
  }, [clientId, navigate]);

  const handleOpenCheckinFromMessage = useCallback(() => {
    void lightHaptic();
    navigate('/submit-checkin');
  }, [navigate]);

  const showQuickReplies = keyboardInset > 0 && !(input ?? '').trim();
  const showThreadSkeleton = clientId && !clientResolved;
  const threadMigrationAttrs = useMemo(() => {
    const roleView = isClientView ? 'client' : 'coach';
    let state;
    if (clientId && !clientResolved) {
      state = deriveMessagesThreadRouteState({ roleView, surface: 'loading' });
    } else if (conversationDeleted && clientId) {
      state = deriveMessagesThreadRouteState({ roleView, surface: 'deleted' });
    } else if (showNotFound) {
      state = deriveMessagesThreadRouteState({ roleView, surface: 'not_found' });
    } else if (!client) {
      state = deriveMessagesThreadRouteState({ roleView, surface: 'no_client' });
    } else if (allMessages.length === 0 && !remoteTyping) {
      state = deriveMessagesThreadRouteState({ roleView, surface: 'empty' });
    } else {
      state = deriveMessagesThreadRouteState({ roleView, surface: 'active' });
    }
    return atlasMigrationDataAttributes(state.phase, state.primary);
  }, [
    isClientView,
    clientId,
    clientResolved,
    conversationDeleted,
    showNotFound,
    client,
    allMessages.length,
    remoteTyping,
  ]);

  if (showThreadSkeleton) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden flex flex-col"
        style={{ background: BG, padding: spacing[16] }}
        {...threadMigrationAttrs}
      >
        <div className="flex items-center gap-3 mb-6">
          <Skeleton height={40} width={40} style={{ borderRadius: '50%' }} />
          <Skeleton height={18} width={120} />
        </div>
        <SkeletonCard lines={4} />
        <div style={{ marginTop: 16 }}><SkeletonCard lines={2} /></div>
        <div style={{ marginTop: 16 }}><SkeletonCard lines={3} /></div>
      </div>
    );
  }

  if (conversationDeleted && clientId) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden flex flex-col flex-1"
        style={{ background: BG, padding: spacing[16] }}
        {...threadMigrationAttrs}
      >
        <EmptyState
          title="Conversation deleted"
          description="Start a new message to create a new thread."
          icon={MessageCircle}
          actionLabel="New message"
          onAction={async () => {
            const thread = typeof data?.ensureThreadForClient === 'function'
              ? await data.ensureThreadForClient(clientId)
              : null;
            if (thread) {
              setCurrentThread(thread);
              setConversationDeleted(false);
              const msgs = await data.listMessages(thread.id ?? clientId);
              setLoadedMessages(Array.isArray(msgs) ? msgs : []);
              setClientResolved(true);
            }
          }}
        />
      </div>
    );
  }

  if (showNotFound) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden flex flex-col items-center justify-center"
        style={{ background: BG, color: MUTED, paddingTop: 24, paddingLeft: 16, paddingRight: 16, minHeight: 200 }}
        {...threadMigrationAttrs}
      >
        <p className="text-sm mb-4">Conversation not found.</p>
        <button
          type="button"
          onClick={() => navigate('/messages')}
          className="rounded-xl px-4 py-2 font-medium"
          style={{ background: ACCENT, color: '#fff', border: 'none' }}
        >
          Back to Messages
        </button>
      </div>
    );
  }

  if (!client) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden flex flex-col flex-1"
        style={{ background: BG, padding: spacing[16] }}
        {...threadMigrationAttrs}
      >
        <EmptyState
          title="Select a conversation"
          description="Choose a thread from Messages to start chatting."
          icon={MessageCircle}
        />
      </div>
    );
  }

  return (
    <div
      className="chat-screen flex-1 min-h-0 flex flex-col"
      style={{
        height: '100%',
        minHeight: 0,
        background: BG,
        color: colors.text,
      }}
      {...threadMigrationAttrs}
    >
      {isReconnecting ? (
        <div
          className="mx-4 mt-2 mb-1 px-3 py-2 rounded-lg text-[12px] flex items-center gap-1.5"
          style={{
            background: colors.surface1,
            color: colors.muted,
            border: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
          Reconnecting…
        </div>
      ) : null}
      <ChatThreadCallControls
        client={client}
        isClientView={isClientView}
        latestCallRequest={latestCallRequest}
        setHeaderRight={setHeaderRight}
        onLightHaptic={lightHaptic}
        onOpenAcceptedCall={openAcceptedCall}
        onStartChatVideoCall={startChatVideoCall}
        onOpenCallRequests={() => navigate('/call-requests')}
        onOpenCallPrep={() => setCallPrepOpen(true)}
      />
      <div
        ref={messagesRef}
        className="chat-messages flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          padding: spacing[16],
          paddingBottom: `calc(${COMPOSER_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <ChatThreadMessageList
          allMessages={allMessages}
          isClientView={isClientView}
          client={client}
          remoteTyping={remoteTyping}
          lastOutgoingMessage={lastOutgoingMessage}
          lastOutgoingDelivery={lastOutgoingDelivery}
          currentThread={currentThread}
          newMessageIds={newMessageIds}
          replyPreviewById={replyPreviewById}
          isDesktopWeb={isDesktopWeb}
          openMessageMenu={openMessageMenu}
          startMediaLongPress={startMediaLongPress}
          cancelMediaLongPress={cancelMediaLongPress}
          setMediaPreview={setMediaPreview}
          retryFailedMessage={retryFailedMessage}
          handleSwipeReply={handleSwipeReply}
          handleOpenCheckinFromMessage={handleOpenCheckinFromMessage}
        />
      </div>

      {showJump && (
        <button
          type="button"
          className="chat-scroll-to-bottom"
          style={{
            position: 'absolute',
            right: 20,
            bottom: `calc(${COMPOSER_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
            zIndex: 10,
            padding: '8px 14px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            background: colors.surface1,
            color: colors.text,
            border: `1px solid ${BORDER}`,
          }}
          onClick={() => {
            lightHaptic();
            smoothJumpToBottom();
          }}
        >
          {newCount > 0 ? `↓ ${newCount} new` : '↓'}
        </button>
      )}

      <ChatThreadComposer
        isDesktopWeb={isDesktopWeb}
        keyboardInset={keyboardInset}
        composerHeight={COMPOSER_HEIGHT}
        desktopSidebarWidth={DESKTOP_SIDEBAR_WIDTH}
        borderColor={BORDER}
        quickReplies={QUICK_REPLIES}
        showQuickReplies={showQuickReplies}
        inputRef={inputRef}
        input={input}
        isSending={isSending}
        clientId={clientId}
        onInputChange={(v) => {
          setInput(v);
          pulseRemoteTypingIndicator();
        }}
        onSendText={sendText}
        onSendVoice={handleSendVoice}
        onOpenAttachment={() => {
          lightHaptic();
          setShowAttachmentSheet(true);
        }}
        onOpenGifPicker={() => {
          lightHaptic();
          setShowGifPicker(true);
        }}
        editingMessage={editingMessage}
        replyTo={replyTo}
        onCancelEdit={() => {
          setEditingMessage(null);
          setInput('');
        }}
        onCancelReply={() => setReplyTo(null)}
        onQuickReply={(text) => {
          lightHaptic();
          setInput(text);
          inputRef.current?.focus();
        }}
        fileInputRef={fileInputRef}
        onImageSelected={handleImageSelected}
        videoFileInputRef={videoFileInputRef}
        onVideoSelected={handleVideoSelected}
        showAttachmentSheet={showAttachmentSheet}
        onAttachmentPhoto={() => {
          void lightHaptic();
          handlePickImage();
          setShowAttachmentSheet(false);
        }}
        onAttachmentCamera={() => {
          void lightHaptic();
          handlePickImage();
          setShowAttachmentSheet(false);
        }}
        onAttachmentVideo={() => {
          void lightHaptic();
          videoFileInputRef.current?.click();
          setShowAttachmentSheet(false);
        }}
        onAttachmentCancel={() => setShowAttachmentSheet(false)}
      />

      <ChatThreadOverlays
        showGifPicker={showGifPicker}
        setShowGifPicker={setShowGifPicker}
        handleSendGif={handleSendGif}
        mediaPreview={mediaPreview}
        setMediaPreview={setMediaPreview}
      />

      <CallPrepSheet
        open={callPrepOpen}
        onOpenChange={setCallPrepOpen}
        client={client}
        clientId={clientId}
        clientName={client?.full_name ?? ''}
        snapshot={contextSnapshot}
        prepNotes={prepNotes}
        onPrepNotesChange={handlePrepNotesChange}
        onSendSummaryCard={handleSendSummaryCard}
        onRequestCheckIn={handleRequestCheckIn}
        onViewClient={handleViewClient}
        onPaymentReminder={handlePaymentReminder}
        lightHaptic={lightHaptic}
        onStartAudioCall={handlePrepAudioStart}
        onStartVideoCall={handlePrepVideoStart}
      />

      {callActive && activeCallRequestId ? (
        <AtlasVideoCall
          callRequestId={activeCallRequestId}
          role={callRole}
          myName={profile?.display_name ?? user?.full_name ?? 'You'}
          theirName={isCoachRole
            ? (client?.full_name ?? client?.name ?? 'Client')
            : (client?.full_name ?? client?.name ?? 'Your coach')}
          onEnd={() => {
            if (supabase && activeCallRequestId) {
              void supabase
                .from('checkin_call_requests')
                .update({
                  status: 'completed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeCallRequestId)
                .in('status', ['ringing', 'accepted', 'in_progress']);
            }
            setCallActive(false);
            setActiveCallRequestId(null);
          }}
        />
      ) : null}

      {menuMessage && menuCapabilities && (
        <MessageActionSheet
          message={menuMessage}
          timestamp={formatMessageTimestamp(menuMessage?.created_date)}
          onCopy={() => handleCopy(menuMessage)}
          onReply={() => handleReply(menuMessage)}
          onEdit={() => handleEdit(menuMessage)}
          onDelete={() => handleDelete(menuMessage)}
          showCopy={menuCapabilities.canCopy}
          showReply={menuCapabilities.canReply}
          showEdit={menuCapabilities.canEdit}
          showDelete={menuCapabilities.canDelete}
          isDesktopWeb={isDesktopWeb}
          anchor={menuAnchor}
          onCancel={() => {
            setMenuMessage(null);
            setMenuAnchor(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteMessage}
        title="Delete message?"
        message="This removes the message for both of you. You can only delete messages that have not been read yet."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteMessage(null)}
      />
    </div>
  );
}
