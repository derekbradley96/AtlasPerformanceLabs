import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pin, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isCoach, normalizeRole } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  syncCommunityMembers,
  fetchRoomForCoach,
  fetchRoomForMember,
  ensureCoachCommunityRoom,
  listGroupMessages,
  listGroupMessagesBefore,
  fetchGroupMessageById,
  listActiveRoomMembers,
  listRoomMembersForCoach,
  insertGroupMessage,
  coachSoftDeleteMessage,
  coachSetCommunityActive,
  coachSetCommunityRules,
  coachSetMemberModeration,
  coachSetPinnedMessage,
  coachSetRoomMode,
  markCommunityRead,
  fetchClientCoachId,
} from '@/data/communityRoomRepo';
import { insertNotificationForRecipient } from '@/lib/notifications';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { PageLoader } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { toast } from 'sonner';
import { createSignedUrl, uploadImageBlob, uploadVideoBlob } from '@/lib/messaging/messageMediaStorage';
import { usePresentationMode } from '@/lib/presentationMode';
import { trackRecoverableError } from '@/services/frictionTracker';
import ChatBubble from '@/components/chat/ChatBubble';
import ChatInputBar from '@/components/chat/ChatInputBar';
import { COMPOSER_HEIGHT } from '@/pages/chat-thread/chatThreadConstants';
const DESKTOP_SIDEBAR_WIDTH = 232;

const MESSAGE_TYPES_COACH = [
  { id: 'text', label: 'Text' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
];

const MESSAGE_TYPES_CLIENT = [
  { id: 'text', label: 'Text' },
  { id: 'meal_share', label: 'Meal' },
  { id: 'workout_share', label: 'Workout' },
  { id: 'win_share', label: 'Win' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
];

function normalizeMentionToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMentionTokens(text) {
  const matches = String(text || '').match(/@([a-z0-9][a-z0-9._-]*(?:\s+[a-z0-9][a-z0-9._-]*){0,2})/gi) || [];
  return matches.map((raw) => normalizeMentionToken(raw.slice(1))).filter(Boolean);
}

export default function CommunityRoomPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user, effectiveRole, supabaseUser } = useAuth();
  const role = normalizeRole(effectiveRole ?? user?.role ?? null);
  const viewerIsCoach = isCoach(role);
  const viewerIsClient = role === 'client';
  const uid = supabaseUser?.id ?? user?.id ?? null;
  const { isDesktopWeb } = usePresentationMode();

  const [body, setBody] = useState('');
  const [messageType, setMessageType] = useState('text');
  const [replyToId, setReplyToId] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [useUrlFallback, setUseUrlFallback] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [isActivatingCommunity, setIsActivatingCommunity] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [manualMessages, setManualMessages] = useState([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const mediaFileInputRef = useRef(null);
  const composerInputRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const messageNodeRefs = useRef(new Map());
  const highlightTimeoutRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl('');
      return;
    }
    const nextUrl = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [mediaFile]);

  const scrollToLatest = useCallback((behavior = 'auto') => {
    const el = messagesScrollRef.current;
    if (!el) return;
    if (behavior === 'smooth' && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= 120;
  }, []);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const scrollToMessage = useCallback((messageId) => {
    if (!messageId) return;
    const scroller = messagesScrollRef.current;
    const targetNode = messageNodeRefs.current.get(messageId);
    if (!scroller || !targetNode) {
      toast.error('Pinned message is not visible in current history');
      return;
    }
    const top = targetNode.offsetTop - 16;
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top, behavior: 'smooth' });
    } else {
      scroller.scrollTop = top;
    }
    setHighlightedMessageId(messageId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimeoutRef.current = null;
    }, 1800);
  }, []);

  const coachIdForRoom = useMemo(() => {
    if (viewerIsCoach) return uid;
    return null;
  }, [viewerIsCoach, uid]);

  const clientCoachQuery = useQuery({
    queryKey: ['community-client-coach', uid],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !uid) return null;
      return fetchClientCoachId(sb, uid);
    },
    enabled: hasSupabase && viewerIsClient && !!uid,
  });

  const effectiveCoachId = viewerIsCoach ? coachIdForRoom : clientCoachQuery.data;

  const roomQuery = useQuery({
    queryKey: ['community-room', effectiveCoachId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !effectiveCoachId) return null;
      if (viewerIsClient && uid) {
        try {
          const memberRoom = await fetchRoomForMember(sb, uid);
          if (memberRoom) return memberRoom;
        } catch (error) {
          if (import.meta.env.DEV) console.warn('[community] member room lookup failed before sync', error);
        }
      }
      try {
        await syncCommunityMembers(sb, effectiveCoachId);
      } catch (error) {
        // Don't hard-fail community page for client users if sync RPC is unavailable.
        if (import.meta.env.DEV) console.warn('[community] sync failed, falling back to existing room lookup', error);
      }
      if (viewerIsClient && uid) {
        try {
          const memberRoom = await fetchRoomForMember(sb, uid);
          if (memberRoom) return memberRoom;
        } catch (error) {
          if (import.meta.env.DEV) console.warn('[community] member room lookup failed after sync', error);
        }
      }
      try {
        return await fetchRoomForCoach(sb, effectiveCoachId);
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[community] coach room lookup failed', error);
        return null;
      }
    },
    enabled: hasSupabase && !!effectiveCoachId && (viewerIsCoach || clientCoachQuery.isSuccess),
  });

  const roomId = roomQuery.data?.id;
  const room = roomQuery.data;

  const membersQuery = useQuery({
    queryKey: ['community-members', roomId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !roomId) return [];
      return listActiveRoomMembers(sb, roomId);
    },
    enabled: hasSupabase && !!roomId,
  });

  const messagesQuery = useQuery({
    queryKey: ['community-messages', roomId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !roomId) return [];
      return listGroupMessages(sb, roomId, 80);
    },
    enabled: hasSupabase && !!roomId,
    refetchInterval: 60000,
  });

  const senderUserIdsForNames = useMemo(() => {
    const rows = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    return Array.from(new Set(rows.map((message) => message?.sender_user_id).filter(Boolean)));
  }, [messagesQuery.data]);

  const senderNamesQuery = useQuery({
    queryKey: ['community-sender-names', roomId, senderUserIdsForNames.join(',')],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || senderUserIdsForNames.length === 0) return [];
      const { data, error } = await sb
        .from('profiles')
        .select('id, display_name, full_name, name')
        .in('id', senderUserIdsForNames);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: hasSupabase && !!roomId && senderUserIdsForNames.length > 0,
  });

  const moderationMembersQuery = useQuery({
    queryKey: ['community-moderation-members', roomId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !roomId) return [];
      return listRoomMembersForCoach(sb, roomId);
    },
    enabled: hasSupabase && !!roomId && viewerIsCoach,
  });

  const pinnedQuery = useQuery({
    queryKey: ['community-pinned', roomQuery.data?.pinned_message_id],
    queryFn: async () => {
      const sb = getSupabase();
      const pid = roomQuery.data?.pinned_message_id;
      if (!sb || !pid) return null;
      return fetchGroupMessageById(sb, pid);
    },
    enabled: hasSupabase && !!roomQuery.data?.pinned_message_id,
  });

  useEffect(() => {
    setRulesDraft(room?.rules_text || '');
  }, [room?.rules_text]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !roomId || !uid) return;
    markCommunityRead(sb, roomId, uid).catch(() => {});
  }, [roomId, uid]);

  /** Prefill from ?shareType=workout&title=… — never auto-imports private check-ins */
  useEffect(() => {
    const st = searchParams.get('shareType');
    if (!st) return;
    if (st === 'workout') {
      setMessageType('workout_share');
      const title = searchParams.get('title') || '';
      setBody(title ? `Workout complete · ${title}` : 'Shared a workout');
    }
    if (st === 'meal') {
      setMessageType('meal_share');
      const kcal = searchParams.get('kcal');
      setBody(kcal ? `Meal logged · ${kcal} kcal` : 'Shared a meal');
    }
    if (st === 'win') {
      setMessageType('win_share');
    }
  }, [searchParams]);

  const handleSend = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !roomId || !uid) return;
    stickToBottomRef.current = true;
    if (room && !room.is_active && !viewerIsCoach) {
      toast.error('Community is currently paused by the coach');
      return;
    }
    const selfMembership = (Array.isArray(membersQuery.data) ? membersQuery.data : []).find((m) => m.user_id === uid);
    if (!viewerIsCoach && selfMembership?.is_muted) {
      toast.error('You are currently muted in this community');
      return;
    }
    const text = (body || '').trim();
    const url = (mediaUrl || '').trim();
    const requiresMedia = messageType === 'image' || messageType === 'video';
    if (!text && !url && messageType !== 'meal_share' && messageType !== 'workout_share' && messageType !== 'win_share') {
      toast.error('Add a message or link');
      return;
    }
    if (requiresMedia && !mediaFile && !url) {
      toast.error('Select a file or paste a URL');
      return;
    }
    const senderRole = viewerIsCoach ? 'coach' : 'client';
    try {
      let finalMediaUrl = url || null;
      if (requiresMedia && mediaFile) {
        const generatedMessageId =
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const threadPath = `group/${roomId}`;
        const path = messageType === 'video'
          ? await uploadVideoBlob({
              supabase: sb,
              threadId: threadPath,
              messageId: generatedMessageId,
              blob: mediaFile,
              mimeType: mediaFile.type || 'video/mp4',
              fileName: mediaFile.name || 'video.mp4',
            })
          : await uploadImageBlob({
              supabase: sb,
              threadId: threadPath,
              messageId: generatedMessageId,
              blob: mediaFile,
              mimeType: mediaFile.type || 'image/jpeg',
              fileName: mediaFile.name || 'image.jpg',
            });
        finalMediaUrl = await createSignedUrl({ supabase: sb, path });
      }
      const sentMessage = await insertGroupMessage(sb, {
        room_id: roomId,
        sender_user_id: uid,
        sender_role: senderRole,
        message_type: messageType,
        body: text || null,
        media_url: finalMediaUrl,
        metadata_json: {
          sender_display_name: user?.full_name || user?.name || (viewerIsCoach ? 'Coach' : 'Client'),
        },
        reply_to_id: replyToId,
      });
      const mentionTokens = extractMentionTokens(text);
      const hasEveryoneMention = mentionTokens.includes('everyone');
      const members = Array.isArray(membersQuery.data) ? membersQuery.data : [];
      const mentionRecipientIds = new Set();
      if (viewerIsCoach && hasEveryoneMention) {
        for (const member of members) {
          if (member?.user_id && member.user_id !== uid) mentionRecipientIds.add(member.user_id);
        }
      }
      for (const token of mentionTokens) {
        if (!token || token === 'everyone') continue;
        for (const member of members) {
          if (!member?.user_id || member.user_id === uid) continue;
          const normalizedName = normalizeMentionToken(member.name);
          if (!normalizedName) continue;
          if (normalizedName === token || normalizedName.startsWith(token)) {
            mentionRecipientIds.add(member.user_id);
          }
        }
      }
      if (mentionRecipientIds.size > 0) {
        const preview = (text || messageType).slice(0, 80);
        const senderLabel = viewerIsCoach ? 'Coach' : 'Team member';
        const mentionTitle = hasEveryoneMention && viewerIsCoach
          ? 'Coach announcement'
          : `${senderLabel} mentioned you`;
        const mentionMessage = hasEveryoneMention && viewerIsCoach
          ? `New @everyone message: ${preview}${preview.length >= 80 ? '…' : ''}`
          : `${senderLabel} mentioned you in Community: ${preview}${preview.length >= 80 ? '…' : ''}`;
        await Promise.all(
          Array.from(mentionRecipientIds).map((recipientId) =>
            insertNotificationForRecipient(
              recipientId,
              'community_mention',
              mentionTitle,
              mentionMessage,
              {
                room_id: roomId,
                group_message_id: sentMessage?.id || null,
                sender_user_id: uid,
              },
              sentMessage?.id || null,
              {
                cooldownMinutes: 1,
                maxPerDay: 80,
                dedupeKey: `community_mention_${sentMessage?.id || ''}_${recipientId}`,
                timingTag: 'immediate',
              }
            )
          )
        );
      }
      setBody('');
      setMediaUrl('');
      setMediaFile(null);
      setUseUrlFallback(false);
      setReplyToId(null);
      queryClient.invalidateQueries({ queryKey: ['community-messages', roomId] });
      toast.success('Posted');
    } catch (e) {
      console.error(e);
      trackRecoverableError('CommunityRoomPage', 'postMessage', e);
      toast.error(e?.message || 'Could not post');
    }
  }, [body, mediaUrl, mediaFile, membersQuery.data, messageType, queryClient, replyToId, room, roomId, uid, user?.full_name, user?.name, viewerIsCoach]);

  const handleDelete = useCallback(
    async (messageId) => {
      const sb = getSupabase();
      if (!sb || !roomId || !uid || !viewerIsCoach) return;
      try {
        await coachSoftDeleteMessage(sb, messageId, roomId, uid);
        queryClient.invalidateQueries({ queryKey: ['community-messages', roomId] });
        queryClient.invalidateQueries({ queryKey: ['community-room', effectiveCoachId] });
        queryClient.invalidateQueries({ queryKey: ['community-pinned'] });
        toast.success('Removed');
      } catch (e) {
        trackRecoverableError('CommunityRoomPage', 'deleteMessage', e);
        toast.error(e?.message || 'Could not remove');
      }
    },
    [effectiveCoachId, queryClient, roomId, uid, viewerIsCoach]
  );

  const handlePin = useCallback(
    async (messageId) => {
      const sb = getSupabase();
      if (!sb || !roomId || !viewerIsCoach) return;
      try {
        const nextPinnedId = room?.pinned_message_id === messageId ? null : messageId;
        await coachSetPinnedMessage(sb, roomId, nextPinnedId);
        queryClient.invalidateQueries({ queryKey: ['community-room', effectiveCoachId] });
        queryClient.invalidateQueries({ queryKey: ['community-pinned', messageId] });
        toast.success(nextPinnedId ? 'Pinned' : 'Unpinned');
      } catch (e) {
        trackRecoverableError('CommunityRoomPage', 'pinMessage', e);
        toast.error(e?.message || 'Could not pin');
      }
    },
    [effectiveCoachId, queryClient, room?.pinned_message_id, roomId, viewerIsCoach]
  );

  const toggleMode = useCallback(
    async () => {
      const sb = getSupabase();
      if (!sb || !roomId || !viewerIsCoach || !roomQuery.data) return;
      const next = roomQuery.data.room_mode === 'coach_led' ? 'community' : 'coach_led';
      try {
        await coachSetRoomMode(sb, roomId, next);
        queryClient.invalidateQueries({ queryKey: ['community-room', effectiveCoachId] });
        toast.success(next === 'coach_led' ? 'Coach-led mode: clients reply or share structured posts' : 'Community mode: everyone can post');
      } catch (e) {
        trackRecoverableError('CommunityRoomPage', 'toggleMode', e);
        toast.error('Could not update mode');
      }
    },
    [effectiveCoachId, queryClient, roomId, roomQuery.data, viewerIsCoach]
  );

  const handleActivateCommunity = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !uid) return;
    setActivationError('');
    setIsActivatingCommunity(true);
    try {
      const coachId = effectiveCoachId || uid;
      await syncCommunityMembers(sb, coachId);
      const roomAfterSync = await ensureCoachCommunityRoom(sb, coachId, {
        rulesText: (rulesDraft || '').trim(),
      });
      if (!roomAfterSync) {
        throw new Error('Could not create community room yet. Please retry.');
      }
      const trimmedRules = (rulesDraft || '').trim();
      if (trimmedRules) {
        await coachSetCommunityRules(sb, roomAfterSync.id, trimmedRules);
      }
      await Promise.all([
        roomQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['community-room', coachId] }),
      ]);
      toast.success('Community activated');
    } catch (e) {
      trackRecoverableError('CommunityRoomPage', 'activateCommunity', e);
      const message = e?.message || 'Could not activate community';
      setActivationError(message);
      toast.error(message);
    } finally {
      setIsActivatingCommunity(false);
    }
  }, [effectiveCoachId, queryClient, roomQuery, rulesDraft, uid]);

  const toggleCommunityActive = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !roomId || !viewerIsCoach || !room) return;
    try {
      await coachSetCommunityActive(sb, roomId, !room.is_active);
      await roomQuery.refetch();
      toast.success(!room.is_active ? 'Community opened to members' : 'Community paused');
    } catch (e) {
      trackRecoverableError('CommunityRoomPage', 'toggleCommunityActive', e);
      toast.error(e?.message || 'Could not update community status');
    }
  }, [room, roomId, roomQuery, viewerIsCoach]);

  const saveRules = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !roomId || !viewerIsCoach) return;
    try {
      await coachSetCommunityRules(sb, roomId, rulesDraft);
      await roomQuery.refetch();
      toast.success('Community rules updated');
    } catch (e) {
      trackRecoverableError('CommunityRoomPage', 'saveRules', e);
      toast.error(e?.message || 'Could not save rules');
    }
  }, [roomId, roomQuery, rulesDraft, viewerIsCoach]);

  const moderateMember = useCallback(async (member, action) => {
    const sb = getSupabase();
    if (!sb || !roomId || !viewerIsCoach || !member?.user_id) return;
    try {
      if (action === 'mute') {
        await coachSetMemberModeration(sb, roomId, member.user_id, { isMuted: !member.is_muted });
      } else if (action === 'ban') {
        const shouldBan = member.member_status === 'active';
        await coachSetMemberModeration(sb, roomId, member.user_id, {
          isMuted: shouldBan ? true : false,
          memberStatus: shouldBan ? 'removed' : 'active',
        });
      }
      await moderationMembersQuery.refetch();
      await membersQuery.refetch();
      toast.success('Member moderation updated');
    } catch (e) {
      trackRecoverableError('CommunityRoomPage', 'moderateMember', e);
      toast.error(e?.message || 'Could not update member');
    }
  }, [membersQuery, moderationMembersQuery, roomId, viewerIsCoach]);

  const messages = (manualMessages.length ? manualMessages : (messagesQuery.data ?? []));
  const pinned = pinnedQuery.data;
  const typeOptions = viewerIsCoach ? MESSAGE_TYPES_COACH : MESSAGE_TYPES_CLIENT;
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const moderationMembers = Array.isArray(moderationMembersQuery.data) ? moderationMembersQuery.data : [];
  const isClientMuted = !!(Array.isArray(membersQuery.data) ? membersQuery.data : []).find((m) => m.user_id === uid)?.is_muted;
  const messageListBottomInset = COMPOSER_HEIGHT + 20;
  const memberNameById = new Map(
    (Array.isArray(membersQuery.data) ? membersQuery.data : []).map((member) => [member.user_id, member.name || member.role])
  );
  const senderNameById = new Map(
    (Array.isArray(senderNamesQuery.data) ? senderNamesQuery.data : []).map((profile) => [
      profile.id,
      profile.display_name || profile.full_name || profile.name || null,
    ])
  );
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id : null;
  const oldestMessageCreatedAt = messages.length > 0 ? messages[0]?.created_at : null;

  const loadOlderMessages = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !roomId || !oldestMessageCreatedAt || loadingOlder) return false;
    setLoadingOlder(true);
    try {
      const older = await listGroupMessagesBefore(sb, roomId, oldestMessageCreatedAt, 60);
      if (!older.length) {
        setHasOlderMessages(false);
        return false;
      }
      setManualMessages((prev) => {
        const base = prev.length ? prev : (messagesQuery.data ?? []);
        const seen = new Set(base.map((m) => m.id));
        const next = [...older.filter((m) => !seen.has(m.id)), ...base];
        return next;
      });
      if (older.length < 60) setHasOlderMessages(false);
      return true;
    } catch (error) {
      trackRecoverableError('CommunityRoomPage', 'loadOlderMessages', error);
      toast.error(error?.message || 'Could not load older messages');
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, oldestMessageCreatedAt, loadingOlder, messagesQuery.data]);

  const jumpToPinned = useCallback(async () => {
    const pinnedId = pinnedQuery.data?.id;
    if (!pinnedId) return;
    if (messageNodeRefs.current.get(pinnedId)) {
      scrollToMessage(pinnedId);
      return;
    }
    for (let attempts = 0; attempts < 8 && !messageNodeRefs.current.get(pinnedId); attempts += 1) {
      // eslint-disable-next-line no-await-in-loop
      const loaded = await loadOlderMessages();
      if (!loaded) break;
    }
    if (messageNodeRefs.current.get(pinnedId)) {
      scrollToMessage(pinnedId);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    try {
      const direct = await fetchGroupMessageById(sb, pinnedId);
      if (direct) {
        setManualMessages((prev) => {
          if (prev.some((m) => m.id === direct.id)) return prev;
          return [direct, ...prev];
        });
        requestAnimationFrame(() => scrollToMessage(direct.id));
      } else {
        toast.error('Pinned message not found in loaded history');
      }
    } catch (error) {
      trackRecoverableError('CommunityRoomPage', 'jumpToPinned', error);
      toast.error(error?.message || 'Could not load pinned message');
    }
  }, [pinnedQuery.data?.id, scrollToMessage, loadOlderMessages]);

  useEffect(() => {
    const fetched = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    setManualMessages(fetched);
    setHasOlderMessages(fetched.length >= 80);
  }, [messagesQuery.data]);

  useEffect(() => {
    stickToBottomRef.current = true;
    requestAnimationFrame(() => scrollToLatest('auto'));
  }, [roomId, scrollToLatest]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !roomId) return undefined;
    const channel = sb
      .channel(`community-live:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages', filter: `room_id=eq.${roomId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['community-messages', roomId] });
          queryClient.invalidateQueries({ queryKey: ['community-pinned'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_rooms', filter: `id=eq.${roomId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['community-room', effectiveCoachId] });
          queryClient.invalidateQueries({ queryKey: ['community-pinned'] });
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [roomId, queryClient, effectiveCoachId]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!lastMessageId) return;
    if (!stickToBottomRef.current) return;
    requestAnimationFrame(() => scrollToLatest('auto'));
  }, [lastMessageId, scrollToLatest]);

  if (!hasSupabase) {
    return (
      <div className="app-screen" style={{ padding: spacing[16] }}>
        <p style={{ color: colors.muted }}>Community requires a connected account.</p>
      </div>
    );
  }

  if (!uid) return <PageLoader />;

  if (viewerIsClient && clientCoachQuery.isLoading) return <PageLoader />;
  if (viewerIsClient && !effectiveCoachId) {
    return (
      <div className="app-screen" style={{ padding: spacing[16] }}>
        <p style={{ color: colors.text }}>No coach linked yet.</p>
        <p className="text-sm mt-2" style={{ color: colors.muted }}>Join your coach to access the team room.</p>
      </div>
    );
  }

  if (roomQuery.isLoading) return <PageLoader />;
  if (roomQuery.isError) {
    return (
      <div style={{ padding: spacing[16] }}>
        <LoadErrorFallback title="Couldn't load community" onRetry={() => roomQuery.refetch()} />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="app-screen" style={{ padding: spacing[16] }}>
        <p style={{ color: colors.text }}>Community room is not available yet.</p>
        {viewerIsCoach ? (
          <>
            <p className="text-sm mt-2" style={{ color: colors.muted }}>
              Set your rules first, then activate community to open access for clients.
            </p>
            <textarea
              value={rulesDraft}
              onChange={(e) => setRulesDraft(e.target.value)}
              rows={4}
              placeholder="Add community rules before activation (respect, no spam, etc.)"
              className="mt-3 w-full rounded-xl px-3 py-2 text-[14px] resize-none"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            />
            {activationError ? (
              <p className="text-xs mt-2 mb-0" style={{ color: colors.destructive }}>
                {activationError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleActivateCommunity}
              disabled={isActivatingCommunity}
              className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: isActivatingCommunity ? colors.surface2 : colors.primary,
                color: '#fff',
                border: 'none',
              }}
            >
              {isActivatingCommunity ? 'Activating…' : 'Activate community'}
            </button>
          </>
        ) : (
          <p className="text-sm mt-2" style={{ color: colors.muted }}>
            Ask your coach to activate Community, then retry.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="app-screen min-h-0 flex flex-col"
      style={{ background: colors.bg, height: '100%', paddingBottom: shell.scrollContentInsetBottom }}
    >
      <header
        className="flex items-center gap-3 shrink-0 border-b"
        style={{
          borderColor: colors.border,
          paddingTop: `max(${spacing[12]}px, env(safe-area-inset-top))`,
          paddingBottom: spacing[12],
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
        }}
      >
        <button
          type="button"
          aria-label="Back"
          className="p-2 -ml-2 rounded-xl"
          style={{ color: colors.text }}
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: colors.primary }} />
            <h1 className="text-[17px] font-semibold truncate m-0" style={{ color: colors.text }}>
              {room?.name || 'Team'}
            </h1>
          </div>
          <p className="text-[12px] m-0 mt-0.5" style={{ color: colors.muted }}>
            {room?.room_mode === 'coach_led' ? 'Coach-led · replies & shares' : 'Community · everyone can post'}
          </p>
        </div>
        {viewerIsCoach && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{ background: room.is_active ? colors.primarySubtle : colors.surface1, color: room.is_active ? colors.primary : colors.text }}
              onClick={toggleCommunityActive}
            >
              {room.is_active ? 'Active' : 'Paused'}
            </button>
            <button type="button" className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: colors.surface1, color: colors.text }} onClick={toggleMode}>
              Mode
            </button>
          </div>
        )}
      </header>

      {pinned && (
        <div
          className="shrink-0"
          style={{
            margin: `${spacing[8]}px ${spacing[16]}px 0`,
            padding: `${spacing[10]}px ${spacing[12]}px`,
            borderRadius: 12,
            border: `1px solid ${colors.primary}`,
            background: colors.surface1,
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <Pin size={14} style={{ color: colors.primary }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
                Pinned
              </span>
            </div>
            {viewerIsCoach ? (
              <button
                type="button"
                className="text-[11px] font-semibold"
                style={{ color: colors.muted }}
                onClick={() => handlePin(pinned.id)}
              >
                Unpin
              </button>
            ) : null}
          </div>
          <p className="text-sm m-0 whitespace-pre-wrap" style={{ color: colors.text }}>
            {pinned.body || pinned.message_type}
          </p>
          <button
            type="button"
            onClick={jumpToPinned}
            className="mt-2 text-[11px] font-semibold"
            style={{ color: colors.primary }}
          >
            Jump to message
          </button>
        </div>
      )}

      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="chat-messages flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          padding: spacing[16],
          paddingBottom: `calc(${messageListBottomInset}px + env(safe-area-inset-bottom, 0px))`,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {!room.is_active && (
          <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
            <p className="text-sm m-0" style={{ color: colors.text }}>
              Community is currently paused by the coach.
            </p>
          </Card>
        )}
        {room.rules_text && (
          <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide m-0 mb-1" style={{ color: colors.muted }}>Community rules</p>
            <p className="text-sm whitespace-pre-wrap m-0" style={{ color: colors.text }}>{room.rules_text}</p>
          </Card>
        )}
        {viewerIsCoach && (
          <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide m-0 mb-2" style={{ color: colors.muted }}>Moderator controls</p>
            <textarea
              value={rulesDraft}
              onChange={(e) => setRulesDraft(e.target.value)}
              rows={3}
              placeholder="Set community rules visible to all members…"
              className="w-full rounded-xl px-3 py-2 text-[14px] resize-none"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            />
            <div className="mt-2 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={saveRules}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: colors.primary, color: '#fff', border: 'none' }}
              >
                Save rules
              </button>
              <button
                type="button"
                onClick={toggleCommunityActive}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                {room.is_active ? 'Pause community' : 'Reopen community'}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {moderationMembers
                .filter((member) => member.role === 'client')
                .map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm m-0" style={{ color: colors.text }}>{member.name || 'Client'}</p>
                      <p className="text-[11px] m-0" style={{ color: colors.muted }}>
                        {member.member_status === 'removed' ? 'Banned' : member.is_muted ? 'Muted' : 'Active'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moderateMember(member, 'mute')}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
                      >
                        {member.is_muted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateMember(member, 'ban')}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: colors.surface1, color: colors.destructive, border: `1px solid ${colors.border}` }}
                      >
                        {member.member_status === 'removed' ? 'Unban' : 'Ban'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        )}
        {messagesQuery.isError && (
          <LoadErrorFallback title="Couldn't load posts" onRetry={() => messagesQuery.refetch()} />
        )}

        <div className="flex flex-col gap-2">
          {(hasOlderMessages || loadingOlder) ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadOlderMessages}
                disabled={loadingOlder}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface1,
                  color: colors.muted,
                  fontSize: 12,
                  padding: '6px 12px',
                }}
              >
                {loadingOlder ? 'Loading…' : 'Load older'}
              </button>
            </div>
          ) : null}
          {messages.map((m, index) => {
            const isOutgoing = m.sender_user_id === uid;
            const prev = messages[index - 1];
            const isConsecutiveFromSameSender = !!prev && prev.sender_user_id === m.sender_user_id;
            const prevTs = prev?.created_at ? new Date(prev.created_at).getTime() : 0;
            const currentTs = m?.created_at ? new Date(m.created_at).getTime() : 0;
            const showMessageTime = !prev || !prevTs || !currentTs || (currentTs - prevTs) > 60000;
            const metadataSenderName = (m?.metadata_json?.sender_display_name || '').toString().trim();
            const senderLabel = isOutgoing
              ? 'You'
              : (
                metadataSenderName
                || senderNameById.get(m.sender_user_id)
                || memberNameById.get(m.sender_user_id)
                || (m.sender_role === 'coach' ? 'Coach' : `Client ${String(m.sender_user_id || '').slice(0, 4)}`)
              );
            const replySource = m.reply_to_id ? messageById.get(m.reply_to_id) : null;
            const bubbleMessage = {
              ...m,
              type: m.message_type,
              created_date: m.created_at,
            };
            return (
              <div
                key={m.id}
                ref={(node) => {
                  if (node) messageNodeRefs.current.set(m.id, node);
                  else messageNodeRefs.current.delete(m.id);
                }}
                className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                style={{
                  borderRadius: 14,
                  padding: highlightedMessageId === m.id ? '2px' : 0,
                  background: highlightedMessageId === m.id ? 'rgba(96,165,250,0.25)' : 'transparent',
                  transition: 'background 0.25s ease',
                }}
              >
                <div style={{ width: '100%', maxWidth: m.message_type === 'image' ? '74%' : '100%' }}>
                  {!isOutgoing && (
                    <p className="m-0 mb-1 text-[11px] font-semibold" style={{ color: colors.muted, paddingLeft: 4 }}>
                      {senderLabel}
                    </p>
                  )}
                  {m.message_type === 'image' ? (
                    <div
                      style={{
                        background: isOutgoing ? colors.primary : colors.surface1,
                        border: isOutgoing ? 'none' : `1px solid ${colors.border}`,
                        borderRadius: isOutgoing ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                        padding: 8,
                        boxShadow: isOutgoing ? '0 2px 6px rgba(0,0,0,0.25)' : undefined,
                      }}
                    >
                      <img
                        src={m.media_url}
                        alt=""
                        style={{ width: '100%', maxWidth: 320, borderRadius: 12, objectFit: 'cover' }}
                      />
                      {m.body ? (
                        <p className="text-[14px] mt-2 mb-0 whitespace-pre-wrap" style={{ color: isOutgoing ? '#fff' : colors.text }}>
                          {m.body}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <ChatBubble
                      message={bubbleMessage}
                      isOutgoing={isOutgoing}
                      isNew={false}
                      isConsecutiveFromSameSender={isConsecutiveFromSameSender}
                      replyPreview={replySource ? (replySource.body || replySource.message_type || 'Message').slice(0, 70) : ''}
                      enableSwipeReply={false}
                      isDesktopWeb={isDesktopWeb}
                      variant="client-thread"
                    />
                  )}
                  {showMessageTime ? (
                    <p
                      style={{
                        fontSize: 10,
                        color: colors.muted,
                        textAlign: isOutgoing ? 'right' : 'left',
                        margin: isOutgoing ? '2px 4px 8px 0' : '2px 0 8px 4px',
                      }}
                    >
                      {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : null}
                  <div className={`mt-1 flex items-center gap-2 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                    <button
                      type="button"
                      className="text-[11px] font-semibold"
                      style={{ color: colors.muted }}
                      onClick={() => setReplyToId(m.id)}
                    >
                      Reply
                    </button>
                    {viewerIsCoach && (
                      <>
                        <button
                          type="button"
                          className="text-[11px] font-semibold"
                          style={{ color: colors.primary }}
                          onClick={() => handlePin(m.id)}
                        >
                          {room?.pinned_message_id === m.id ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          type="button"
                          className="text-[11px]"
                          style={{ color: colors.destructive }}
                          onClick={() => handleDelete(m.id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="chat-composer flex flex-col flex-shrink-0 w-full"
        style={{
          position: 'fixed',
          left: isDesktopWeb ? `calc(${DESKTOP_SIDEBAR_WIDTH}px + env(safe-area-inset-left, 0px))` : 0,
          right: 0,
          bottom: 0,
          paddingTop: 8,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          paddingLeft: `calc(12px + env(safe-area-inset-left, 0px))`,
          paddingRight: `calc(12px + env(safe-area-inset-right, 0px))`,
          background: colors.surface1,
          borderTop: `1px solid ${colors.border}`,
          zIndex: 40,
        }}
      >
        <input
          ref={mediaFileInputRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            const nextFile = e.target.files?.[0] || null;
            setMediaFile(nextFile);
            if (!nextFile) return;
            setMessageType(nextFile.type?.startsWith('video/') ? 'video' : 'image');
          }}
        />
        <ChatInputBar
          value={body}
          onChange={setBody}
          onSend={handleSend}
          onAttach={() => mediaFileInputRef.current?.click()}
          replyTo={replyToId ? { body: (messageById.get(replyToId)?.body || messageById.get(replyToId)?.message_type || 'message') } : null}
          onClearReply={() => setReplyToId(null)}
          inputRef={composerInputRef}
          placeholder={room?.room_mode === 'coach_led' && viewerIsClient ? 'Reply or share meal / workout / win…' : 'Message...'}
          hasAttachment={!!mediaFile}
          isSending={false}
        />
        {mediaPreviewUrl ? (
          messageType === 'video' ? (
            <video src={mediaPreviewUrl} controls playsInline style={{ width: '100%', maxWidth: 220, borderRadius: 12, background: '#000', marginBottom: 4 }} />
          ) : (
            <img src={mediaPreviewUrl} alt="" style={{ width: '100%', maxWidth: 220, borderRadius: 12, objectFit: 'cover', marginBottom: 4 }} />
          )
        ) : null}
      </div>
    </div>
  );
}
