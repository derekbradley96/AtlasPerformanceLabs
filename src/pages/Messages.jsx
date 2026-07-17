import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { atlasMigrationDataAttributes, deriveMessagesListRouteState } from '@/lib/atlasMigrationPhases';
import { useNavigate, useLocation, useSearchParams, useOutletContext } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Pin, PinOff, Trash2, MessageSquare, Search, Plus, ChevronRight, Send, MailOpen } from 'lucide-react';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/roles';
import { getPinnedIds, togglePinned, removeFromPinned } from '@/lib/pinsStore';
import { getDeletedIds } from '@/lib/deletedThreadsStore';
import { sortThreadsWithPinned } from '@/lib/messagesThreadsSelectors';
import HoldMenu from '@/components/ui/HoldMenu';
import ThreadRow from '@/components/messages/ThreadRow';
import EmptyState from '@/components/ui/EmptyState';
import { MessagesListSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BroadcastMessageSheet from '@/components/messages/BroadcastMessageSheet';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { colors, spacing, shell, touchTargetMin } from '@/ui/tokens';
import { sectionLabel, desktopRhythm } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import { toast } from 'sonner';
import { getMessagesListPath, navigateToThread } from '@/lib/messagesPath';

// Stable default for the threads query: an inline `= []` makes a new array
// identity every render while data is undefined (loading/error), and the
// state-mirroring effect below then loops setState → "Maximum update depth".
const EMPTY_THREADS = [];

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

function formatThreadTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  const oneWeek = 7 * oneDay;

  if (diff < oneDay && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 2 * oneDay) return 'Yesterday';
  if (diff < oneWeek) {
    return d.toLocaleDateString('en-GB', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authReady, effectiveRole, clientLinkedRow } = useAuth();
  const role = normalizeRole(effectiveRole ?? user?.role ?? null);
  const isCoachView = role === 'coach';
  const isClientView = role === 'client';
  const filterUnread = searchParams.get('filter') === 'unread';
  const isListPage = location.pathname === '/messages';
  const data = useData();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isCoachView) return;
    if (typeof data?.ensureThreadForClient === 'function' && typeof data?.sendMessage === 'function') return;
    if (import.meta.env.DEV) console.warn('[BroadcastMessageSheet] data methods missing');
  }, [data?.ensureThreadForClient, data?.sendMessage, isCoachView]);
  const { isDesktopWeb } = usePresentationMode();
  const rhythm = desktopRhythm(isDesktopWeb);
  // Flat rows sit inside the scroller's own page padding, so they only need
  // enough inset for the press tint to breathe — the card's 14 double-indented.
  const rowPadY = isDesktopWeb ? 12 : 10;
  const rowPadX = isDesktopWeb ? 12 : 6;
  const outletContext = useOutletContext() || {};
  const { registerRefresh, setHeaderRight } = outletContext;
  const [refreshKey, setRefreshKey] = useState(0);
  const [clients, setClientsState] = useState([]);
  const [threads, setThreadsState] = useState([]);
  const [deletedIds, setDeletedIds] = useState(() => getDeletedIds());
  const [pinnedIds, setPinnedIds] = useState(() => getPinnedIds());
  const [startConversationOpen, setStartConversationOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientIdToDelete, setClientIdToDelete] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  /** Inbox and other entry points: `/messages?compose=1` opens the same client picker as the FAB. */
  useEffect(() => {
    if (!isCoachView || !isListPage) return;
    const compose = searchParams.get('compose');
    const wantsCompose =
      compose === '1' ||
      compose === 'true' ||
      searchParams.get('new') === '1';
    if (!wantsCompose) return;
    setStartConversationOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('compose');
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [isCoachView, isListPage, searchParams, setSearchParams]);

  const { pullY, refreshing, handlers, scrollElRef } = usePullToRefresh({
    disabled: isDesktopWeb,
    onRefresh: async () => {
      loadData();
      setRefreshKey((k) => k + 1);
    },
  });

  useEffect(() => {
    document.title = 'Messages — Atlas';
  }, []);

  const {
    data: supabaseThreads = EMPTY_THREADS,
    isLoading: threadsLoading,
    refetch: refetchThreads,
    isError: threadsError,
  } = useQuery({
    queryKey: ['threads', user?.id, role],
    queryFn: () => data.listThreads(),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const loadData = useCallback(() => {
    if (!isClientView && typeof data?.listClients === 'function') {
      data.listClients().then((c) => setClientsState(Array.isArray(c) ? c : []));
    }
    void refetchThreads();
  }, [data, isClientView, refetchThreads]);

  useEffect(() => {
    // Guard only while auth is truly unresolved (no user yet).
    // In some client sessions, authReady can lag while user is already available.
    // If we keep forcing dataLoading=true in that state, the list skeleton can stick forever.
    if (hasSupabase && !authReady && !user?.id) {
      setDataLoading(true);
      setLoadError(false);
      return;
    }
    const listClients = data?.listClients;
    if ((!isClientView && typeof listClients !== 'function')) {
      setDataLoading(true);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    loadData();
    const onUpdate = () => {
      if (cancelled) return;
      loadData();
    };
    window.addEventListener('atlas-sandbox-updated', onUpdate);
    window.addEventListener('atlas-messaging-updated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('atlas-sandbox-updated', onUpdate);
      window.removeEventListener('atlas-messaging-updated', onUpdate);
    };
  }, [authReady, data, loadData, isClientView, user?.id]);

  useEffect(() => {
    setThreadsState(Array.isArray(supabaseThreads) ? supabaseThreads : []);
    setLoadError(Boolean(threadsError));
    setDataLoading(Boolean(threadsLoading));
  }, [supabaseThreads, threadsError, threadsLoading]);

  useEffect(() => {
    if (isListPage) loadData();
  }, [isListPage, loadData]);

  useEffect(() => {
    if (!isListPage) return undefined;
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadData();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [isListPage, loadData]);

  useEffect(() => {
    const onDeleted = () => setDeletedIds(getDeletedIds());
    window.addEventListener('atlas-deleted-threads-changed', onDeleted);
    return () => window.removeEventListener('atlas-deleted-threads-changed', onDeleted);
  }, []);

  useEffect(() => {
    if (typeof registerRefresh !== 'function') return;
    return registerRefresh(() => {
      loadData();
      setRefreshKey((k) => k + 1);
    });
  }, [registerRefresh, loadData]);

  const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds]);

  const threadList = useMemo(() => {
    const clientsById = new Map((clients ?? []).map((c) => [c?.id, c]));
    let list = (threads || [])
      .map((thread) => {
        const cid = thread.client_id ?? thread.id;
        const client = clientsById.get(cid) ?? { id: cid, full_name: thread.client_name || 'Client' };
        return { client, thread };
      })
      .filter(({ thread }) => {
        const id = thread?.client_id ?? thread?.id;
        return id && !deletedSet.has(id);
      });
    if (filterUnread) list = list.filter((item) => (item.thread?.unread_count ?? 0) > 0);
    list = sortThreadsWithPinned(list, pinnedIds);
    return list;
  }, [clients, threads, filterUnread, deletedSet, pinnedIds]);

  const totalUnread = useMemo(
    () => (Array.isArray(threadList) ? threadList : []).reduce((sum, { thread }) => sum + (Number(thread?.unread_count) || 0), 0),
    [threadList]
  );

  useEffect(() => {
    const markAll = data.markAllThreadsRead;
    if (typeof setHeaderRight !== 'function' || totalUnread <= 0 || typeof markAll !== 'function') {
      if (typeof setHeaderRight === 'function') setHeaderRight(null);
      return;
    }
    setHeaderRight(
      <button
        type="button"
        onClick={() => {
          lightHaptic();
          markAll?.();
          loadData();
          setRefreshKey((k) => k + 1);
        }}
        className="text-[15px] font-medium px-2 py-1 rounded-lg active:opacity-80"
        style={{ color: colors.accent, background: 'transparent', border: 'none', minHeight: touchTargetMin }}
      >
        Mark all read
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, totalUnread, data.markAllThreadsRead, loadData]);

  const handleRow = useCallback(
    async (clientId, threadId, clientName) => {
      await lightHaptic();
      const readTarget = threadId ?? clientId;
      if (readTarget) {
        try {
          data.markThreadRead?.(readTarget);
        } catch (_) {}
      }
      const name = (clientName ?? '').trim();
      navigateToThread(navigate, clientId, {
        state: name ? { clientName: name } : undefined,
      });
    },
    [navigate, data]
  );

  const handleDeleteRequest = useCallback((clientId) => {
    setClientIdToDelete(clientId);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!clientIdToDelete) return;
    try {
      if (typeof data?.deleteThread === 'function') await data.deleteThread(clientIdToDelete);
      removeFromPinned(clientIdToDelete);
      setDeleteConfirmOpen(false);
      setClientIdToDelete(null);
      loadData();
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error('Could not delete conversation');
    }
  }, [clientIdToDelete, data, loadData]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setClientIdToDelete(null);
  }, []);

  const handlePinToggle = useCallback((clientId) => {
    togglePinned(clientId);
    setPinnedIds(getPinnedIds());
  }, []);

  const handleMarkRead = useCallback((clientId, threadId) => {
    try {
      data.markThreadRead?.(threadId ?? clientId);
    } catch (_) {}
    loadData();
  }, [data, loadData]);

  const handleStartConversation = useCallback(async (client) => {
    if (!client?.id) return;
    await lightHaptic();
    setStartConversationOpen(false);
    setClientSearch('');
    if (typeof data?.ensureThreadForClient === 'function') {
      await data.ensureThreadForClient(client.id);
    }
    loadData();
    const clientName = (client?.full_name ?? client?.name ?? '').trim();
    navigateToThread(navigate, client.id, {
      state: {
        from: getMessagesListPath(),
        ...(clientName ? { clientName } : {}),
      },
    });
  }, [navigate, loadData, data]);

  const filteredClients = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    const q = (clientSearch || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c?.full_name || c?.name || '').toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(false);
    loadData();
  }, [loadData]);

  const messagesListMigration = useMemo(() => {
    const roleView = isClientView ? 'client' : 'coach';
    if (dataLoading) return deriveMessagesListRouteState({ roleView, surface: 'loading', unreadFilter: filterUnread });
    if (loadError) return deriveMessagesListRouteState({ roleView, surface: 'error', unreadFilter: filterUnread });
    if (threadList.length === 0) {
      return deriveMessagesListRouteState({ roleView, surface: 'empty', unreadFilter: filterUnread });
    }
    return deriveMessagesListRouteState({ roleView, surface: 'list', unreadFilter: filterUnread });
  }, [dataLoading, loadError, threadList.length, isClientView, filterUnread]);

  return (
    <div
      {...atlasMigrationDataAttributes(messagesListMigration.phase, messagesListMigration.primary)}
      {...handlers}
      className="app-screen min-w-0 max-w-full overflow-x-hidden flex-1 min-h-0 flex flex-col"
      style={{
        position: 'relative',
        background: colors.bg,
        maxWidth: isDesktopWeb ? 1240 : undefined,
        margin: '0 auto',
        width: '100%',
        paddingTop: rhythm.top,
      }}
    >
      <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} />
      {dataLoading ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <MessagesListSkeleton count={6} />
        </div>
      ) : loadError ? (
        <div className="flex-1 min-h-0 flex items-center justify-center" style={{ padding: spacing[16] }}>
          <LoadErrorFallback
            title="Couldn't load conversations"
            description="Check your connection and try again."
            onRetry={handleRetryLoad}
          />
        </div>
      ) : threadList.length === 0 ? (
        <div className="flex-1 min-h-0 overflow-auto" style={{ paddingLeft: spacing[16], paddingRight: spacing[16] }}>
          {isCoachView && clients.length > 0 ? (
            <div style={{ padding: `${spacing[16]}px` }}>
              <p style={{ fontSize: 13, color: colors.muted, marginBottom: spacing[12] }}>
                Start a conversation with a client:
              </p>
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    const clientName = (client?.full_name ?? client?.name ?? '').trim();
                    navigateToThread(navigate, client.id, {
                      state: clientName ? { clientName } : undefined,
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[12],
                    width: '100%',
                    padding: `${spacing[12]}px`,
                    marginBottom: spacing[8],
                    background: colors.surface1,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: colors.primarySubtle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 600,
                      color: colors.primary,
                      flexShrink: 0,
                    }}
                  >
                    {(client.full_name || client.name || 'C')[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: 0 }}>
                      {client.full_name || client.name}
                    </p>
                    <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                      Tap to start conversation
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: colors.muted }} />
                </button>
              ))}
            </div>
          ) : isClientView ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${spacing[32]}px ${spacing[16]}px`,
                textAlign: 'center',
                gap: spacing[16],
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: colors.primarySubtle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={24} style={{ color: colors.primary }} />
              </div>
              <div>
                <p style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: colors.text,
                  margin: 0,
                  marginBottom: spacing[6],
                }}>
                  Message your coach
                </p>
                <p style={{
                  fontSize: 14,
                  color: colors.muted,
                  margin: 0,
                  lineHeight: 1.5,
                  maxWidth: 260,
                }}>
                  Send a message to your coach. They'll reply here.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const rosterId = clientLinkedRow?.id;
                  if (!rosterId) return;
                  if (typeof data?.ensureConversation === 'function') {
                    await data.ensureConversation(rosterId);
                  }
                  navigateToThread(navigate, rosterId);
                }}
                style={{
                  padding: `${spacing[12]}px ${spacing[24]}px`,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Send first message →
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <EmptyState
                title="No messages yet"
                description="This is where your client conversations appear. Your clients can message you from their app."
                icon={MessageSquare}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col relative">
          <div
            ref={scrollElRef}
            className="flex-1 min-h-0 overflow-y-auto"
            style={{
              WebkitOverflowScrolling: 'touch',
              paddingLeft: shell.pagePaddingH,
              paddingRight: shell.pagePaddingH,
              paddingTop: isDesktopWeb ? spacing[16] : shell.topSpacing,
              paddingBottom: shell.scrollContentInsetBottom,
              maxWidth: isDesktopWeb ? 1100 : undefined,
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div
              className="flex items-center justify-between gap-2"
              style={{ marginBottom: isDesktopWeb ? spacing[10] : shell.sectionLabelMarginBottom }}
            >
              <span style={sectionLabel}>{isClientView ? 'Messages' : 'Conversations'}</span>
              {isCoachView ? (
                <button
                  type="button"
                  onClick={() => {
                    lightHaptic();
                    setBroadcastOpen(true);
                  }}
                  className="rounded-lg p-2 active:opacity-80"
                  style={{
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                  }}
                  aria-label="Message all clients"
                  title="Message all clients"
                >
                  <Send size={16} />
                </button>
              ) : null}
            </div>

            {Array.isArray(threadList) ? threadList.map(({ client, thread }) => {
              const threadId = client?.id ?? thread?.client_id ?? thread?.id ?? 'unknown';
              const isPinned = pinnedIds.includes(threadId);
              const name = isClientView
                ? 'Your coach'
                : (client?.full_name ?? thread?.name ?? '') || 'Client';
              const lastMessageAt = thread?.last_message_at ?? thread?.lastMessageAt ?? null;
              const previewRaw = (thread?.last_message_preview ?? thread?.lastMessage ?? '').trim();
              const lastMessage = previewRaw || 'No messages yet';
              const unreadCount = Number(thread?.unread_count ?? thread?.unreadCount ?? 0) || 0;
              const clientId = client?.id ?? thread?.client_id;
              const timeLabel = formatThreadTime(lastMessageAt);

              const menuItems = isClientView ? [] : [
                {
                  key: 'pin',
                  label: isPinned ? 'Unpin' : 'Pin',
                  icon: isPinned ? PinOff : Pin,
                  onSelect: () => handlePinToggle(threadId),
                },
                ...(unreadCount > 0 ? [{
                  key: 'read',
                  label: 'Mark as read',
                  icon: MailOpen,
                  onSelect: () => handleMarkRead(clientId, thread?.id),
                }] : []),
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => handleDeleteRequest(threadId),
                },
              ];

              const rowContent = (
                <ThreadRow
                  name={name}
                  avatarUrl={client?.profiles?.avatar_url ?? client?.avatar_url}
                  lastMessage={lastMessage}
                  timeLabel={timeLabel}
                  unreadCount={unreadCount}
                  isPinned={isPinned}
                  padY={rowPadY}
                  padX={rowPadX}
                />
              );

              return (
                <HoldMenu
                  key={threadId}
                  items={menuItems}
                  label={name}
                  onPress={() => handleRow(clientId, thread?.id, name)}
                  disabled={isClientView}
                  radius={16}
                  liftBackground={colors.surface1}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Open chat with ${name}`}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      handleRow(clientId, thread?.id, name);
                    }}
                    className="atlas-thread-row"
                    style={{ borderRadius: 16, cursor: 'pointer' }}
                  >
                    {rowContent}
                  </div>
                </HoldMenu>
              );
            }) : null}
          </div>
        </div>
      )}

      {/* Always show compose button for coaches */}
      {isCoachView && !startConversationOpen && (
        <button
          type="button"
          onClick={() => { lightHaptic(); setStartConversationOpen(true); }}
          className="fixed flex items-center justify-center rounded-full shadow-lg active:opacity-90 transition-opacity"
          style={{
            width: 56,
            height: 56,
            right: 16,
            bottom: `calc(88px + env(safe-area-inset-bottom, 0px))`,
            background: colors.primary,
            color: '#fff',
            border: 'none',
            zIndex: 30,
          }}
          aria-label="New message"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {startConversationOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Start conversation"
        >
          <div
            className="flex-shrink-0 flex items-center justify-between gap-2 py-3 border-b"
            style={{ borderColor: colors.border, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH }}
          >
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Choose client</h2>
            <button
              type="button"
              onClick={() => { setStartConversationOpen(false); setClientSearch(''); }}
              className="text-sm font-medium"
              style={{ color: colors.accent, minHeight: touchTargetMin }}
            >
              Cancel
            </button>
          </div>
          <div
            className="flex-shrink-0 py-2 border-b"
            style={{ borderColor: colors.border, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH }}
          >
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}>
              <Search size={18} style={{ color: colors.muted }} />
              <input
                type="search"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px]"
                style={{ color: colors.text }}
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-center gap-3" style={{ paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH }}>
                <p className="text-sm" style={{ color: colors.text }}>
                  {clientSearch.trim() ? "No clients match your search." : "You don't have any clients yet."}
                </p>
                <p className="text-sm max-w-[260px]" style={{ color: colors.muted }}>
                  {clientSearch.trim()
                    ? "Try a different name or clear the search to see all clients."
                    : "Add a client from the Clients page to start messaging them."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (clientSearch.trim()) setClientSearch('');
                    else { setStartConversationOpen(false); navigate('/clients'); }
                  }}
                  className="text-sm font-medium py-2 px-4 rounded-lg"
                  style={{
                    background: colors.primarySubtle,
                    color: colors.primary,
                    border: 'none',
                    cursor: 'pointer',
                    minHeight: touchTargetMin,
                  }}
                >
                  {clientSearch.trim() ? 'Clear search' : 'Open clients'}
                </button>
              </div>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c?.id}
                  type="button"
                  onClick={() => handleStartConversation(c)}
                  className="w-full text-left flex items-center gap-3 py-3 active:opacity-80 border-b"
                  style={{ borderColor: colors.border, color: colors.text, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium" style={{ background: colors.surface1, color: colors.muted }}>
                    {(c?.full_name || c?.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 min-w-0 truncate font-medium">{c?.full_name || c?.name || 'Client'}</span>
                  <MessageSquare size={18} style={{ color: colors.muted, flexShrink: 0 }} />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete conversation?"
        message="This deletes the conversation and messages for both you and the client."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      {isCoachView && (
        <BroadcastMessageSheet
          open={broadcastOpen}
          onOpenChange={setBroadcastOpen}
          clients={clients}
          ensureThreadForClient={data?.ensureThreadForClient}
          sendMessage={data?.sendMessage}
          onSent={() => {
            loadData();
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
