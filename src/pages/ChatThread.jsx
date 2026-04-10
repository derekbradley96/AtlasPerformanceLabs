/**
 * ChatThread – chat UI with Call/Video actions and coach Context panel.
 * Scrollable message list, bubbles left/right, timestamps grouped, empty state, composer.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Phone, Video, MessageCircle, Reply, Smile, X } from 'lucide-react';
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { trackFriction, trackRecoverableError } from '@/services/frictionTracker';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { atlasMigrationDataAttributes, deriveMessagesThreadRouteState } from '@/lib/atlasMigrationPhases';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';
import { getClientRiskEvaluation } from '@/lib/riskService';
import { getChatContextSnapshot } from '@/lib/chatContextSnapshot';
import { getCoachPrepNotes, setCoachPrepNotes } from '@/lib/coachPrepNotesStore';
import { safeDate } from '@/lib/format';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useChatScrollState } from '@/components/app/useChatScrollState';
import MessageActionSheet from '@/components/messages/MessageActionSheet';
import MessageStatusFooter from '@/components/app/MessageStatusFooter';
import TypingIndicator from '@/components/app/TypingIndicator';
import ChatBubble from '@/components/chat/ChatBubble';
import AudioMessage from '@/components/chat/AudioMessage';
import QuickReplyChips from '@/components/chat/QuickReplyChips';
import VoiceNoteComposer from '@/components/messages/VoiceNoteComposer';
import AudioBubble from '@/components/messages/AudioBubble';
import { addAudioMessage, sendVoiceMessage, listMessages as listLocalMessages, deleteMessage as deleteMessageFromStore } from '@/lib/messaging/messageStore';
import { compressImage } from '@/lib/messaging/messageMediaStorage';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import CallPrepSheet from '@/components/chat/CallPrepSheet';
import SummaryCardBubble from '@/components/chat/SummaryCardBubble';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/skeleton';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { toast } from 'sonner';

import { colors, spacing } from '@/ui/tokens';
const BG = colors.bg;
const ACCENT = colors.primary;
const MUTED = colors.muted;
const BORDER = colors.border;
const AUTO_SCROLL_THRESHOLD = 120;
/** Composer bar height (padding + input row) for thread padding-bottom. */
const COMPOSER_HEIGHT = 72;
const MEDIA_LONG_PRESS_MS = 360;
const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';
const QUICK_REPLIES = ['Got it!', 'On it', 'Send when you can', 'Sounds good'];
const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'dc6zaTOxFJmzC';
/** Clock / ordering slack so read cursors count as covering the message. */
const READ_RECEIPT_TIME_SLACK_MS = 2500;

function isOptimisticMessageId(id) {
  const s = String(id ?? '');
  return (
    s.startsWith('local-') ||
    s.startsWith('local-img-') ||
    s.startsWith('local-gif-') ||
    s.startsWith('voice-') ||
    s.startsWith('audio-')
  );
}

/** True if a server row is the persisted version of a still-optimistic local row (race: realtime before send().then updates id). */
function optimisticMatchesServerRow(localMsg, serverMsg) {
  if (!localMsg || !serverMsg) return false;
  if (String(localMsg.sender || '') !== String(serverMsg.sender || '')) return false;
  const lb = String(localMsg.body || '').trim();
  const sb = String(serverMsg.body || '').trim();
  if (lb.length > 0 || sb.length > 0) {
    if (lb !== sb) return false;
    const lt = safeDate(localMsg.created_date)?.getTime() ?? 0;
    const st = safeDate(serverMsg.created_date)?.getTime() ?? 0;
    return Math.abs(st - lt) < 120000;
  }
  const lu = localMsg.media_url ? String(localMsg.media_url) : '';
  const su = serverMsg.media_url ? String(serverMsg.media_url) : '';
  if (lu && su && lu === su) return true;
  const lt = localMsg.type || 'text';
  const st = serverMsg.type || 'text';
  if (lt === st && (lt === 'voice' || lt === 'image' || lt === 'gif')) {
    const ltm = safeDate(localMsg.created_date)?.getTime() ?? 0;
    const stm = safeDate(serverMsg.created_date)?.getTime() ?? 0;
    return Math.abs(stm - ltm) < 180000;
  }
  return false;
}

function formatMessageTimestamp(iso) {
  const d = safeDate(iso);
  if (!d) return '';
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDueDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function dateGroupLabel(iso) {
  const d = safeDate(iso);
  if (!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const other = new Date(d);
  other.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - other) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

async function heavyHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}

/** Allow "Delete for everyone" when recipient has not read. TODO: tie into real read receipts when Supabase messages table exists. */
function canDeleteForEveryone(message, isClientView) {
  const isOutgoingSender = isClientView
    ? message?.sender === 'client'
    : message?.sender === 'coach' || message?.sender === 'trainer';
  if (!message || !isOutgoingSender) return false;
  if (message.read_at != null || message?.status === 'read') return false;
  const sentAt = message?.created_date ? new Date(message.created_date).getTime() : 0;
  const within60s = sentAt && Date.now() - sentAt < 60 * 1000;
  const notDelivered = message?.status !== 'delivered' && message?.status !== 'read';
  return within60s || notDelivered;
}

/** Attachment action sheet: Photo, Camera, Cancel. */
function AttachmentActionSheet({ onPhoto, onCamera, onCancel }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);
  return (
    <>
      <div role="presentation" className="fixed inset-0 z-40" style={{ background: colors.overlay }} onClick={onCancel} />
      <div
        className="fixed left-4 right-4 z-50 rounded-2xl overflow-hidden border"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', background: BG, borderColor: BORDER }}
      >
        <div className="py-1">
          <button type="button" onClick={() => { lightHaptic(); onPhoto(); onCancel(); }} className="w-full py-3 text-[15px] font-medium active:bg-white/5" style={{ color: colors.text }}>Photo</button>
          <button type="button" onClick={() => { lightHaptic(); onCamera(); onCancel(); }} className="w-full py-3 text-[15px] font-medium active:bg-white/5" style={{ color: colors.text }}>Camera</button>
        </div>
        <div className="border-t" style={{ borderColor: BORDER }}>
          <button type="button" onClick={onCancel} className="w-full py-3 text-[15px] font-semibold active:bg-white/5" style={{ color: MUTED }}>Cancel</button>
        </div>
      </div>
    </>
  );
}

export default function ChatThread() {
  const { clientId } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const data = useData();
  const { user, effectiveRole, clientLinkedRow, profile } = useAuth();
  const role = normalizeRole(effectiveRole ?? user?.role ?? null);
  const isClientView = role === 'client';
  const outgoingSenderKey = isClientView ? 'client' : 'coach';
  const { setHeaderTitle, setHeaderRight } = useOutletContext() || {};
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const [loadedClient, setLoadedClient] = useState(null);
  const [clientResolved, setClientResolved] = useState(false);
  const [loadedMessages, setLoadedMessages] = useState([]);
  const [currentThread, setCurrentThread] = useState(null);
  const [callPrepOpen, setCallPrepOpen] = useState(false);
  const [prepNotes, setPrepNotesState] = useState('');
  const [conversationDeleted, setConversationDeleted] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setLoadedClient(null);
      setClientResolved(true);
      setLoadedMessages([]);
      setCurrentThread(null);
      setConversationDeleted(false);
      return;
    }
    setClientResolved(false);
    setConversationDeleted(false);
    setCurrentThread(null);
    let cancelled = false;
    if (isClientView && clientLinkedRow?.id && clientId === clientLinkedRow.id) {
      const nm = profile?.full_name || profile?.name || 'You';
      setLoadedClient({ id: clientLinkedRow.id, full_name: nm, name: nm });
    } else {
      data.getClient(clientId).then((c) => {
        if (!cancelled) setLoadedClient(c ?? null);
      });
    }
    const ensureAndLoad = async () => {
      const thread = isClientView
        ? await (typeof data?.getThread === 'function' ? data.getThread(clientId) : null)
        : typeof data?.ensureThreadForClient === 'function'
          ? await data.ensureThreadForClient(clientId)
          : await data.getThread?.(clientId) ?? null;
      if (cancelled) return;
      if (!thread) {
        setConversationDeleted(true);
        setLoadedMessages([]);
        setClientResolved(true);
        return;
      }
      setCurrentThread(thread);
      const threadId = thread?.id ?? clientId;
      const fromData = await data.listMessages(threadId).catch(() => []);
      if (cancelled) return;
      let list = Array.isArray(fromData) ? fromData : [];
      try {
        const localList = await listLocalMessages(clientId);
        const localOnly = (Array.isArray(localList) ? localList : []).filter((m) => m?.type === 'audio' || m?.type === 'voice');
        const normalized = localOnly.map((m) => {
          const base = { id: m.id, client_id: clientId, sender: m.sender === 'coach' || m.sender === 'trainer' ? 'coach' : m.sender, created_date: m.created_at ?? m.created_date };
          if (m.type === 'voice') return { ...base, type: 'voice', audioKey: m.audioKey, mimeType: m.mimeType, durationMs: m.durationMs };
          return { ...base, type: 'audio', audioDataUrl: m.audioDataUrl, durationMs: m.durationMs };
        });
        const seen = new Set(list.map((x) => x.id));
        normalized.forEach((n) => { if (!seen.has(n.id)) { seen.add(n.id); list.push(n); } });
        list = list.sort((a, b) => (new Date(a?.created_date || 0)).getTime() - (new Date(b?.created_date || 0)).getTime());
      } catch (_) {}
      if (!cancelled) {
        setLoadedMessages(list);
        setClientResolved(true);
      }
      data.markThreadRead?.(threadId);
    };
    ensureAndLoad();
    return () => { cancelled = true; };
  }, [clientId, data, isClientView, clientLinkedRow?.id, profile?.full_name, profile?.name]);

  useEffect(() => {
    const prefilled = location.state?.prefilledMessage;
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
  }, [location.pathname, location.state?.prefilledMessage, navigate, searchParams, setSearchParams]);

  const [localMessages, setLocalMessages] = useState([]);
  const [menuMessage, setMenuMessage] = useState(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null);
  const [pendingDeleteType, setPendingDeleteType] = useState(null); // 'me' | 'everyone'
  const [replyTo, setReplyTo] = useState(null);
  /** Other party is typing (Supabase Realtime broadcast). */
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(() => new Set());
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [mediaPreview, setMediaPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [isSending, setIsSending] = useState(false);
  const statusTimersRef = useRef([]);
  const realtimeChannelRef = useRef(null);
  const channelSubscribedRef = useRef(false);
  const remoteTypingHideRef = useRef(null);
  const lastTypingBroadcastRef = useRef(0);
  const atBottomRef = useRef(true);
  const mediaLongPressTimeoutRef = useRef(null);

  const { keyboardInset } = useKeyboardInset();
  const { atBottom, showJump, newCount, smoothJumpToBottom, markNewMessage, checkBottom } =
    useChatScrollState(messagesRef, AUTO_SCROLL_THRESHOLD);
  atBottomRef.current = atBottom;

  const client = loadedClient ?? (clientId ? getClientById(clientId) : null);
  const showNotFound = clientId && clientResolved && !client;

  const checkInsListRaw = clientId ? getClientCheckIns(clientId) : [];
  const checkInsList = Array.isArray(checkInsListRaw) ? checkInsListRaw : [];
  const markedPaid = clientId ? getClientMarkedPaid(clientId) : false;
  const pendingCheckIns = checkInsList.filter((c) => c?.status === 'pending');
  const nextCheckInDueRaw = pendingCheckIns.length ? (pendingCheckIns[0]?.due_date ?? pendingCheckIns[0]?.created_date ?? null) : null;
  const nextCheckInDue = formatDueDate(nextCheckInDueRaw);
  const paymentStatus = markedPaid ? 'Paid' : (client?.payment_overdue ? 'Overdue' : 'Pending');

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
      const source = byId.get(msg?.reply_to_id);
      const body = String(source?.body || '').trim();
      if (!body || !msg?.id) return;
      result.set(msg.id, body.length > 70 ? `${body.slice(0, 70)}...` : body);
    });
    return result;
  }, [allMessages]);

  const startMediaLongPress = useCallback((message) => {
    if (mediaLongPressTimeoutRef.current) clearTimeout(mediaLongPressTimeoutRef.current);
    mediaLongPressTimeoutRef.current = setTimeout(() => {
      setMenuMessage(message);
    }, MEDIA_LONG_PRESS_MS);
  }, []);

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
    if (isClientView) {
      setHeaderTitle('Your coach');
      return () => setHeaderTitle(null);
    }
    setHeaderTitle(client?.full_name || 'Chat');
    return () => setHeaderTitle(null);
  }, [client, setHeaderTitle, isClientView]);

  useEffect(() => {
    setPrepNotesState(clientId ? getCoachPrepNotes(clientId) : '');
  }, [clientId]);

  const contextSnapshot = useMemo(
    () =>
      clientId
        ? getChatContextSnapshot(clientId, {
            getClientById: (id) => getClientById(id),
            getClientCheckIns: (id) => getClientCheckIns(id),
            getClientRiskEvaluation: (id) => getClientRiskEvaluation(id),
          })
        : { wins: [], slips: [], flags: [], checkInDue: null, lastCheckIn: null },
    [clientId, client]
  );

  useEffect(() => {
    if (typeof setHeaderRight !== 'function' || !client || isClientView) {
      if (typeof setHeaderRight === 'function') setHeaderRight(null);
      return () => {};
    }
    setHeaderRight(
      <div className="flex items-center gap-1" style={{ alignItems: 'center' }}>
        <button
          type="button"
          onClick={async () => {
            await lightHaptic();
            setCallPrepOpen(true);
          }}
          className="p-2.5 rounded-lg active:opacity-70 transition-opacity"
          style={{ color: colors.text, background: 'transparent', border: 'none', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Call"
        >
          <Phone size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={async () => {
            await lightHaptic();
            setCallPrepOpen(true);
          }}
          className="p-2.5 rounded-lg active:opacity-70 transition-opacity"
          style={{ color: colors.text, background: 'transparent', border: 'none', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Video call"
        >
          <Video size={20} strokeWidth={2} />
        </button>
      </div>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, client, isClientView]);

  const handlePrepNotesChange = useCallback(
    (text) => {
      setPrepNotesState(text ?? '');
      if (clientId) setCoachPrepNotes(clientId, text ?? '');
    },
    [clientId]
  );

  const handleSendSummaryCard = useCallback(
    (payload) => {
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
      const threadId = currentThread?.id ?? clientId;
      if (threadId) {
        data.sendMessage(threadId, bodyText).then((added) => {
          if (added) setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, id: added.id, status: 'sent', summaryPayload: payload } : m)));
        });
      }
      toast.success('Summary sent to chat');
    },
    [clientId, currentThread, data, isClientView]
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

  const handleSend = useCallback(() => {
    const text = (input ?? '').trim();
    const hasContent = text.length > 0;
    if (!hasContent) return;
    lightHaptic();
    setIsSending(true);
    const created_date = new Date().toISOString();
    const bodyToSend = text;
    const newMsg = {
      id: `local-${Date.now()}`,
      client_id: clientId,
      sender: outgoingSenderKey,
      body: text || '(attachment)',
      created_date,
      status: 'sending',
      ...(replyTo?.id && { reply_to_id: replyTo.id }),
    };
    setNewMessageIds((prev) => new Set([...prev, newMsg.id]));
    setLocalMessages((prev) => [...prev, newMsg]);
    setInput('');
    setReplyTo(null);

    const finishSend = () => {
      setIsSending(false);
    };

    const threadId = currentThread?.id ?? clientId;
    if (threadId) {
      data.sendMessage(threadId, bodyToSend).then((added) => {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m?.id === newMsg.id
              ? { ...m, id: added?.id ?? m.id, status: 'delivered', deliveredAt: Date.now() }
              : m
          )
        );
        finishSend();
      }).catch((err) => {
        trackFriction('message_send_failed', { threadId, clientId });
        trackRecoverableError('ChatThread', 'sendMessage', err);
        setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, status: 'sent' } : m)));
        toast.error('Failed to send message');
        finishSend();
      });
    } else {
      setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, status: 'delivered', deliveredAt: Date.now() } : m)));
      finishSend();
    }

    requestAnimationFrame(() => scrollToBottom(true));
  }, [input, clientId, currentThread, scrollToBottom, data, replyTo, outgoingSenderKey]);

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(async (event) => {
    const file = event.target?.files?.[0];
    if (!file || !clientId) return;
    event.target.value = '';
    setIsSending(true);
    try {
      const compressed = await compressImage(file);
      const localUrl = URL.createObjectURL(compressed);
      const created_date = new Date().toISOString();
      const localId = `local-img-${Date.now()}`;
      setLocalMessages((prev) => [...prev, {
        id: localId,
        client_id: clientId,
        sender: outgoingSenderKey,
        type: 'image',
        media_url: localUrl,
        body: '',
        created_date,
        status: 'sending',
      }]);
      const threadId = currentThread?.id ?? clientId;
      const added = await data.sendMessage(threadId, {
        type: 'image',
        blob: compressed,
        mimeType: compressed.type || 'image/jpeg',
        text: '',
        fileName: file.name || 'image.jpg',
      });
      if (added) {
        setLocalMessages((prev) => prev.map((m) => (
          m?.id === localId ? { ...m, id: added.id, media_url: added.media_url || m.media_url, status: 'delivered' } : m
        )));
      }
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (err) {
      toast.error('Failed to send image');
    } finally {
      setIsSending(false);
    }
  }, [clientId, currentThread, data, scrollToBottom, outgoingSenderKey]);

  const handleSendGif = useCallback(async (gifUrl) => {
    if (!gifUrl || !clientId) return;
    setShowGifPicker(false);
    setIsSending(true);
    try {
      const response = await fetch(gifUrl);
      const blob = await response.blob();
      const created_date = new Date().toISOString();
      const localId = `local-gif-${Date.now()}`;
      setLocalMessages((prev) => [...prev, {
        id: localId,
        client_id: clientId,
        sender: outgoingSenderKey,
        type: 'gif',
        media_url: gifUrl,
        body: '',
        created_date,
        status: 'sending',
      }]);
      const threadId = currentThread?.id ?? clientId;
      const added = await data.sendMessage(threadId, {
        type: 'gif',
        blob,
        mimeType: 'image/gif',
        text: '',
        fileName: 'gif.gif',
      });
      if (added) {
        setLocalMessages((prev) => prev.map((m) => (
          m?.id === localId ? { ...m, id: added.id, media_url: added.media_url || m.media_url, status: 'delivered' } : m
        )));
      }
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (_) {
      toast.error('Failed to send GIF');
    } finally {
      setIsSending(false);
    }
  }, [clientId, currentThread, data, scrollToBottom, outgoingSenderKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const query = gifSearch.trim();
      const endpoint = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=16&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=16&rating=pg`;
      try {
        const res = await fetch(endpoint);
        const json = await res.json();
        if (!cancelled) setGifResults(Array.isArray(json?.data) ? json.data : []);
      } catch (_) {
        if (!cancelled) setGifResults([]);
      }
    };
    if (showGifPicker) run();
    return () => { cancelled = true; };
  }, [showGifPicker, gifSearch]);

  useEffect(() => {
    const threadId = currentThread?.id;
    if (!threadId || !hasSupabase) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadId));
    if (!isUuid) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const myRole = isClientView ? 'client' : 'coach';
    const channel = supabase.channel(`chat-live-${threadId}`, {
      config: { broadcast: { self: false } },
    });
    realtimeChannelRef.current = channel;
    channelSubscribedRef.current = false;

    const mergeMessagesFromServer = async () => {
      const latest = await data.listMessages(threadId).catch(() => []);
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
        data.markThreadRead?.(threadId);
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
      } catch (_) {}
      requestAnimationFrame(() => scrollToBottom(false));
    };

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
          void mergeMessagesFromServer();
        }
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
              : prev
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channelSubscribedRef.current = true;
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') channelSubscribedRef.current = false;
      });

    return () => {
      channelSubscribedRef.current = false;
      realtimeChannelRef.current = null;
      if (remoteTypingHideRef.current) clearTimeout(remoteTypingHideRef.current);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [currentThread?.id, data, scrollToBottom, isClientView]);

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
  }, [isClientView]);

  const sendText = useCallback(
    (textToSend) => {
      const t = (textToSend ?? '').trim();
      if (!t) return;
      lightHaptic();
      setIsSending(true);
      const created_date = new Date().toISOString();
      const newMsg = {
        id: `local-${Date.now()}`,
        client_id: clientId,
        sender: outgoingSenderKey,
        body: t,
        created_date,
        status: 'sending',
        ...(replyTo?.id && { reply_to_id: replyTo.id }),
      };
      setNewMessageIds((prev) => new Set([...prev, newMsg.id]));
      setLocalMessages((prev) => [...prev, newMsg]);
      setInput('');
      setReplyTo(null);
      const threadId = currentThread?.id ?? clientId;
      if (threadId) {
        data.sendMessage(threadId, t).then((added) => {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m?.id === newMsg.id ? { ...m, id: added?.id ?? m.id, status: 'delivered', deliveredAt: Date.now() } : m
            )
          );
          setIsSending(false);
        }).catch((err) => {
          trackFriction('message_send_failed', { threadId: currentThread?.id ?? clientId, clientId });
          trackRecoverableError('ChatThread', 'sendMessage', err);
          setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, status: 'sent' } : m)));
          toast.error('Failed to send message');
          setIsSending(false);
        });
      } else {
        setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, status: 'delivered' } : m)));
        setIsSending(false);
      }
      requestAnimationFrame(() => scrollToBottom(true));
    },
    [clientId, currentThread, data, scrollToBottom, replyTo, outgoingSenderKey]
  );

  const handleSendVoice = useCallback(
    async ({ audioKey, mimeType, durationMs, blob }) => {
      if ((!audioKey && !blob) || !clientId) return;
      lightHaptic();
      const created_date = new Date().toISOString();
      const threadId = currentThread?.id ?? clientId;
      const newMsg = {
        id: `voice-${Date.now()}`,
        client_id: clientId,
        sender: outgoingSenderKey,
        type: 'voice',
        audioKey: audioKey || null,
        mimeType: mimeType || 'audio/webm',
        durationMs: durationMs || 0,
        created_date,
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
          });
          if (added) {
            setLocalMessages((prev) =>
              prev.map((m) =>
                m?.id === newMsg.id
                  ? { ...m, id: added.id, media_url: added.media_url }
                  : m
              )
            );
            return;
          }
        }
        const added = await sendVoiceMessage(clientId, { sender: outgoingSenderKey, audioKey, mimeType, durationMs });
        if (added) setLocalMessages((prev) => prev.map((m) => (m?.id === newMsg.id ? { ...m, id: added.id } : m)));
      } catch (_) {
        toast.error('Failed to send voice note');
      }
    },
    [clientId, currentThread, data, scrollToBottom, outgoingSenderKey]
  );

  const handleVoiceNoteDone = useCallback(
    async ({ audioDataUrl, durationMs }) => {
      if (!audioDataUrl || !clientId) return;
      lightHaptic();
      const created_date = new Date().toISOString();
      const newMsg = {
        id: `audio-${Date.now()}`,
        client_id: clientId,
        sender: outgoingSenderKey,
        type: 'audio',
        audioDataUrl,
        durationMs: durationMs || 0,
        created_date,
      };
      setLocalMessages((prev) => [...prev, newMsg]);
      requestAnimationFrame(() => scrollToBottom(true));
      try {
        await addAudioMessage(clientId, { sender: outgoingSenderKey, audioDataUrl, durationMs: durationMs || 0 });
      } catch (_) {}
    },
    [clientId, scrollToBottom, outgoingSenderKey]
  );

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
    } catch (_) {
      toast.error('Copy failed');
    }
    setMenuMessage(null);
  }, []);

  const handleReply = useCallback((message) => {
    setReplyTo(message ?? null);
    setMenuMessage(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleDelete = useCallback((message) => {
    if (!message?.id) return;
    setPendingDeleteMessage(message);
    setPendingDeleteType('me');
    setMenuMessage(null);
  }, []);

  const handleDeleteForEveryone = useCallback((message) => {
    if (!message?.id || !canDeleteForEveryone(message, isClientView)) return;
    setPendingDeleteMessage(message);
    setPendingDeleteType('everyone');
    setMenuMessage(null);
  }, [isClientView]);

  const handleConfirmDeleteForMe = useCallback(async () => {
    if (!pendingDeleteMessage || pendingDeleteType !== 'me') return;
    heavyHaptic();
    setLocalMessages((prev) => prev.filter((m) => m?.id !== pendingDeleteMessage.id));
    setPendingDeleteMessage(null);
    setPendingDeleteType(null);
  }, [pendingDeleteMessage, pendingDeleteType]);

  const handleConfirmDeleteForEveryone = useCallback(async () => {
    if (!pendingDeleteMessage || pendingDeleteType !== 'everyone') return;
    heavyHaptic();
    try {
      await deleteMessageFromStore(clientId, pendingDeleteMessage.id);
    } catch (_) {}
    setLocalMessages((prev) => prev.filter((m) => m?.id !== pendingDeleteMessage.id));
    setLoadedMessages((prev) => (Array.isArray(prev) ? prev.filter((m) => m?.id !== pendingDeleteMessage.id) : []));
    setPendingDeleteMessage(null);
    setPendingDeleteType(null);
  }, [clientId, pendingDeleteMessage, pendingDeleteType]);

  const handleSwipeReply = useCallback((message) => {
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
        className="min-h-0 flex-1"
        aria-hidden="true"
        {...threadMigrationAttrs}
      />
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
      <div
        ref={messagesRef}
        className="chat-messages flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          padding: spacing[16],
          paddingBottom: `calc(${COMPOSER_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: allMessages.length === 0 && !remoteTyping ? 'center' : 'flex-start',
          }}
        >
          {allMessages.length === 0 && !remoteTyping ? (
            <EmptyState
              title="No messages yet"
              description={
                isClientView
                  ? 'When your coach messages you, it will show up here.'
                  : 'Send a message to start the conversation.'
              }
              icon={MessageCircle}
              actionLabel={isClientView ? undefined : 'Request check-in'}
              onAction={
                isClientView
                  ? undefined
                  : () => {
                      lightHaptic();
                      setCallPrepOpen(true);
                    }
              }
            />
          ) : (
            Array.isArray(allMessages) &&
            allMessages.map((m, idx) => {
              const isOutgoing = isClientView
                ? m?.sender === 'client'
                : m?.sender === 'coach' || m?.sender === 'trainer';
              const prev = allMessages[idx - 1];
              const prevDate = prev?.created_date ? dateGroupLabel(prev.created_date) : '';
              const thisDate = m?.created_date ? dateGroupLabel(m.created_date) : '';
              const showDateLabel = thisDate && thisDate !== prevDate;
              const isConsecutiveFromSameSender = prev != null && prev?.sender === m?.sender;
              const isLastOutgoingWithStatus = lastOutgoingMessage?.id === m?.id && !!lastOutgoingDelivery.status;
              return (
                <React.Fragment key={m?.id ?? idx}>
                  {showDateLabel && (
                    <div className="flex justify-center my-3" style={{ alignSelf: 'center' }}>
                      <span
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: colors.surface1,
                          color: colors.muted,
                        }}
                      >
                        {thisDate}
                      </span>
                    </div>
                  )}
                  {m?.summaryPayload ? (
                    <div
                      onContextMenu={(e) => { e.preventDefault(); setMenuMessage(m); }}
                      onPointerDown={() => startMediaLongPress(m)}
                      onPointerUp={cancelMediaLongPress}
                      onPointerCancel={cancelMediaLongPress}
                      onPointerLeave={cancelMediaLongPress}
                    >
                      <SummaryCardBubble message={m} isOutgoing={isOutgoing} />
                    </div>
                  ) : m?.type === 'voice' ? (
                    <div
                      onContextMenu={(e) => { e.preventDefault(); setMenuMessage(m); }}
                      onPointerDown={() => startMediaLongPress(m)}
                      onPointerUp={cancelMediaLongPress}
                      onPointerCancel={cancelMediaLongPress}
                      onPointerLeave={cancelMediaLongPress}
                    >
                      <AudioBubble
                        audioKey={m.audioKey}
                        mimeType={m.mimeType}
                        durationMs={m.durationMs ?? m.duration_ms}
                        isMine={isOutgoing}
                        mediaUrl={m.media_url}
                        messageId={m.id}
                      />
                    </div>
                  ) : m?.type === 'audio' ? (
                    <div
                      onContextMenu={(e) => { e.preventDefault(); setMenuMessage(m); }}
                      onPointerDown={() => startMediaLongPress(m)}
                      onPointerUp={cancelMediaLongPress}
                      onPointerCancel={cancelMediaLongPress}
                      onPointerLeave={cancelMediaLongPress}
                    >
                      <AudioMessage message={m} isOutgoing={isOutgoing} />
                    </div>
                  ) : (m?.type === 'image' || m?.type === 'gif') ? (
                    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={() => setMediaPreview(m.media_url)}
                        onContextMenu={(e) => { e.preventDefault(); setMenuMessage(m); }}
                        onPointerDown={() => startMediaLongPress(m)}
                        onPointerUp={cancelMediaLongPress}
                        onPointerCancel={cancelMediaLongPress}
                        onPointerLeave={cancelMediaLongPress}
                        style={{ maxWidth: '72%', border: 'none', background: 'transparent', padding: 0 }}
                      >
                        <img
                          src={m.media_url}
                          alt=""
                          style={{
                            width: '100%',
                            maxHeight: 280,
                            objectFit: 'cover',
                            borderRadius: 14,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </button>
                    </div>
                  ) : (
                    <ChatBubble
                      message={m}
                      isOutgoing={isOutgoing}
                      isNew={newMessageIds.has(m?.id)}
                      isConsecutiveFromSameSender={isConsecutiveFromSameSender}
                      replyPreview={replyPreviewById.get(m?.id) || ''}
                      onLongPress={setMenuMessage}
                      onSwipeReply={handleSwipeReply}
                      onDelete={handleDelete}
                      canDelete={isOutgoing}
                    />
                  )}
                  {isLastOutgoingWithStatus && !m?.summaryPayload && (
                    <div className="flex justify-end" style={{ marginTop: -2, marginBottom: 8, paddingRight: 4 }}>
                      <MessageStatusFooter
                        status={lastOutgoingDelivery.status}
                        readAt={lastOutgoingDelivery.readAt}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
          {remoteTyping && (
            <div className="flex justify-start" style={{ marginBottom: 8 }}>
              <TypingIndicator
                label={isClientView ? 'Your coach' : (client?.full_name || client?.name || 'Client')}
              />
            </div>
          )}
        </div>
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

      <div
        className="chat-composer flex flex-col flex-shrink-0 w-full"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(-${keyboardInset}px)`,
          zIndex: 40,
          paddingTop: 8,
          paddingLeft: `calc(12px + env(safe-area-inset-left, 0px))`,
          paddingRight: `calc(12px + env(safe-area-inset-right, 0px))`,
          background: 'rgba(17, 24, 39, 0.92)',
          borderTop: `1px solid ${BORDER}`,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {replyTo && (
          <div
            className="flex items-center gap-2 py-2 px-3 rounded-xl mb-2"
            style={{
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Reply size={14} style={{ color: colors.muted, flexShrink: 0 }} />
            <span className="text-[13px] truncate flex-1 min-w-0" style={{ color: colors.muted }}>
              Replying to {replyTo.body ? (replyTo.body.length > 40 ? `${replyTo.body.slice(0, 40)}…` : replyTo.body) : 'message'}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-[13px] font-medium flex-shrink-0 active:opacity-80" style={{ color: colors.muted }} aria-label="Cancel reply">×</button>
          </div>
        )}
        <QuickReplyChips
          options={QUICK_REPLIES}
          onSelect={(text) => {
            lightHaptic();
            setInput(text);
            inputRef.current?.focus();
          }}
          visible={showQuickReplies}
        />
        <div
          className="flex items-center gap-2 w-full"
          style={{ minHeight: COMPOSER_HEIGHT - 20 }}
        >
          <div className="flex-1 min-w-0">
            <VoiceNoteComposer
              disabled={isSending}
              onSendText={sendText}
              onSendVoice={handleSendVoice}
              placeholder="Message..."
              clientId={clientId}
              onAttach={() => { lightHaptic(); setShowAttachmentSheet(true); }}
              inputRef={inputRef}
              value={input}
              onChange={(v) => {
                setInput(v);
                pulseRemoteTypingIndicator();
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              lightHaptic();
              setShowGifPicker(true);
            }}
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Open GIF picker"
          >
            <Smile size={18} />
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
      </div>

      {showAttachmentSheet && (
        <AttachmentActionSheet
          onPhoto={() => {
            handlePickImage();
            setShowAttachmentSheet(false);
          }}
          onCamera={() => {
            handlePickImage();
            setShowAttachmentSheet(false);
          }}
          onCancel={() => setShowAttachmentSheet(false)}
        />
      )}

      {showGifPicker && (
        <div className="fixed inset-0 z-40" style={{ background: colors.overlay }}>
          <div className="absolute inset-x-3 top-8 bottom-8 rounded-2xl border flex flex-col" style={{ background: colors.bg, borderColor: colors.border }}>
            <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: colors.border }}>
              <input
                value={gifSearch}
                onChange={(e) => setGifSearch(e.target.value)}
                placeholder="Search GIFs"
                style={{ flex: 1, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, padding: '8px 10px' }}
              />
              <button type="button" onClick={() => setShowGifPicker(false)} style={{ border: 'none', background: 'transparent', color: colors.muted }}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
              {gifResults.map((g) => {
                const url = g?.images?.fixed_width?.url || g?.images?.downsized?.url;
                if (!url) return null;
                return (
                  <button key={g.id} type="button" onClick={() => handleSendGif(url)} style={{ border: 'none', padding: 0, background: 'transparent' }}>
                    <img src={url} alt={g?.title || 'gif'} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mediaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={() => setMediaPreview(null)}>
          <img src={mediaPreview} alt="" style={{ maxWidth: '94vw', maxHeight: '92vh', objectFit: 'contain' }} />
        </div>
      )}

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
      />

      {menuMessage && (
        <MessageActionSheet
          message={menuMessage}
          timestamp={formatMessageTimestamp(menuMessage?.created_date)}
          onCopy={() => handleCopy(menuMessage)}
          onReply={() => handleReply(menuMessage)}
          onDelete={() => handleDelete(menuMessage)}
          onDeleteForEveryone={() => handleDeleteForEveryone(menuMessage)}
          showDelete={
            isClientView
              ? menuMessage?.sender === 'client'
              : menuMessage?.sender === 'coach' || menuMessage?.sender === 'trainer'
          }
          showDeleteForEveryone={
            (isClientView
              ? menuMessage?.sender === 'client'
              : menuMessage?.sender === 'coach' || menuMessage?.sender === 'trainer') &&
            canDeleteForEveryone(menuMessage, isClientView)
          }
          onCancel={() => setMenuMessage(null)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteMessage && pendingDeleteType === 'me'}
        title="Delete for me?"
        message="This removes the message from your view only. The client will still see it."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDeleteForMe}
        onCancel={() => { setPendingDeleteMessage(null); setPendingDeleteType(null); }}
      />
      <ConfirmDialog
        open={!!pendingDeleteMessage && pendingDeleteType === 'everyone'}
        title="Delete for everyone?"
        message="This removes the message for you and the client. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDeleteForEveryone}
        onCancel={() => { setPendingDeleteMessage(null); setPendingDeleteType(null); }}
      />
    </div>
  );
}
