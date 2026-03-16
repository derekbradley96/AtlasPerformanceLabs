import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams, useOutletContext } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Pin, PinOff, Trash2, MessageSquare, Search, Plus, ChevronRight } from 'lucide-react';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/roles';
import { formatRelativeDate } from '@/lib/format';
import { getPinnedIds, togglePinned, removeFromPinned } from '@/lib/pinsStore';
import { getDeletedIds, addDeletedId } from '@/lib/deletedThreadsStore';
import { sortThreadsWithPinned } from '@/lib/messagesThreadsSelectors';
import SwipeRow from '@/components/messages/SwipeRow';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { MessagesListSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors, spacing, shell } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';
import { toast } from 'sonner';

const PIN_BG = colors.primary;
const UNPIN_BG = colors.surface2;
const DELETE_BG = colors.danger;

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

export default function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, authReady } = useAuth();
  const role = normalizeRole(user ?? null);
  const isClientView = role === 'client';
  const filterUnread = searchParams.get('filter') === 'unread';
  const isListPage = location.pathname === '/messages' || location.pathname === '/trainer/messages' || location.pathname.endsWith('/messages');
  const data = useData();
  const outletContext = useOutletContext() || {};
  const { registerRefresh, setHeaderRight } = outletContext;
  const [refreshKey, setRefreshKey] = useState(0);
  const [clients, setClientsState] = useState([]);
  const [threads, setThreadsState] = useState([]);
  const [deletedIds, setDeletedIds] = useState(() => getDeletedIds());
  const [deletingId, setDeletingId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState(() => getPinnedIds());
  const [openRowId, setOpenRowId] = useState(null);
  const [openSide, setOpenSide] = useState(null);
  const [startConversationOpen, setStartConversationOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientIdToDelete, setClientIdToDelete] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(() => {
    if (typeof data?.listClients === 'function') data.listClients().then((c) => setClientsState(Array.isArray(c) ? c : []));
    if (typeof data?.listThreads === 'function') data.listThreads().then((th) => setThreadsState(Array.isArray(th) ? th : []));
  }, [data]);

  useEffect(() => {
    if (hasSupabase && !authReady) {
      setDataLoading(true);
      setLoadError(false);
      return;
    }
    const listClients = data?.listClients;
    const listThreads = data?.listThreads;
    if (typeof listClients !== 'function' || typeof listThreads !== 'function') {
      setDataLoading(true);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    setLoadError(false);
    Promise.all([listClients(), listThreads()])
      .then(([c, th]) => {
        if (!cancelled) {
          setClientsState(Array.isArray(c) ? c : []);
          setThreadsState(Array.isArray(th) ? th : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setClientsState([]);
          setThreadsState([]);
          setLoadError(true);
          toast.error('Failed to load conversations');
          if (import.meta.env?.DEV) console.error('[Messages] load error', err);
        }
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    const onUpdate = () => { if (!cancelled) loadData(); };
    window.addEventListener('atlas-sandbox-updated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('atlas-sandbox-updated', onUpdate);
    };
  }, [authReady, data, loadData, refreshKey]);

  useEffect(() => {
    if (isListPage) loadData();
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
    if (filterUnread) list.sort((a, b) => (b.thread?.unread_count ?? 0) - (a.thread?.unread_count ?? 0));
    else list = sortThreadsWithPinned(list, pinnedIds);
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
        style={{ color: colors.accent, background: 'transparent', border: 'none' }}
      >
        Mark all read
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, totalUnread, data.markAllThreadsRead, loadData]);

  const handleRow = useCallback(
    async (clientId) => {
      if (openRowId != null) return;
      if (openRowId === clientId) return;
      if (deletingId === clientId) return;
      await lightHaptic();
      navigate(`/messages/${clientId}`);
    },
    [navigate, openRowId, deletingId]
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

  const handleDeleteAnimationEnd = useCallback((clientId) => {
    addDeletedId(clientId);
    removeFromPinned(clientId);
    setDeletedIds(getDeletedIds());
    setDeletingId(null);
    setOpenRowId(null);
    setOpenSide(null);
  }, []);

  const handlePinToggle = useCallback((clientId) => {
    lightHaptic();
    togglePinned(clientId);
    setPinnedIds(getPinnedIds());
    setOpenRowId(null);
    setOpenSide(null);
  }, []);

  const handleSwipeStart = useCallback((id) => {
    setOpenRowId(null);
    setOpenSide(null);
  }, []);

  const handleOpenLeft = useCallback((id) => {
    setOpenRowId(id);
    setOpenSide('left');
  }, []);

  const handleOpenRight = useCallback((id) => {
    setOpenRowId(id);
    setOpenSide('right');
  }, []);

  const handleClose = useCallback(() => {
    setOpenRowId(null);
    setOpenSide(null);
  }, []);

  const handleStartConversation = useCallback(async (client) => {
    if (!client?.id) return;
    await lightHaptic();
    setStartConversationOpen(false);
    setClientSearch('');
    if (typeof data?.ensureThreadForClient === 'function') {
      await data.ensureThreadForClient(client.id);
    }
    loadData();
    navigate(`/messages/${client.id}`, { state: { from: '/messages' } });
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

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden flex-1 min-h-0 flex flex-col"
      style={{ background: colors.bg }}
    >
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
        <div className="flex-1 min-h-0 flex flex-col justify-center" style={{ paddingLeft: spacing[16], paddingRight: spacing[16] }}>
          <EmptyState
            title={isClientView ? "You don't have any messages yet" : "No conversations yet"}
            description={isClientView
              ? "Your thread with your coach will appear here once you or your coach sends a message. Say hi to get started."
              : "Start a conversation by choosing a client below. You can also open a client profile and tap Message."}
            icon={MessageSquare}
            actionLabel={isClientView ? undefined : 'New message'}
            onAction={isClientView ? undefined : () => { lightHaptic(); setStartConversationOpen(true); }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col relative">
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch', paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: shell.topSpacing, paddingBottom: 120 }}
          >
            <div style={{ marginBottom: shell.sectionLabelMarginBottom }}>
              <span style={sectionLabel}>{isClientView ? 'Messages' : 'Conversations'}</span>
            </div>

            {Array.isArray(threadList) ? threadList.map(({ client, thread }) => {
              const threadId = client?.id ?? thread?.client_id ?? thread?.id ?? 'unknown';
              const isPinned = pinnedIds.includes(threadId);
              const name = (client?.full_name ?? thread?.name ?? '') || 'Client';
              const lastMessageAt = thread?.last_message_at ?? thread?.lastMessageAt ?? null;
              const previewRaw = (thread?.last_message_preview ?? thread?.lastMessage ?? '').trim();
              const lastMessage = previewRaw || 'Tap to start a conversation';
              const unreadCount = Number(thread?.unread_count ?? thread?.unreadCount ?? 0) || 0;
              const clientId = client?.id ?? thread?.client_id;
              const timeLabel = lastMessageAt ? formatRelativeDate(lastMessageAt) : '';

              const stopActionEvent = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
              };
              const leftActions = (
                <button
                  type="button"
                  onPointerDown={stopActionEvent}
                  onPointerUp={stopActionEvent}
                  onTouchStart={stopActionEvent}
                  onTouchEnd={stopActionEvent}
                  onClick={(e) => {
                    stopActionEvent(e);
                    handlePinToggle(threadId);
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 w-full h-full border-0 cursor-pointer"
                  style={{
                    background: isPinned ? UNPIN_BG : PIN_BG,
                    color: '#fff',
                    padding: 8,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 44,
                  }}
                  aria-label={isPinned ? 'Unpin' : 'Pin'}
                >
                  {isPinned ? <PinOff size={22} /> : <Pin size={22} />}
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                    {isPinned ? 'Unpin' : 'Pin'}
                  </span>
                </button>
              );

              const rightActions = (
                <button
                  type="button"
                  onPointerDown={stopActionEvent}
                  onPointerUp={stopActionEvent}
                  onTouchStart={stopActionEvent}
                  onTouchEnd={stopActionEvent}
                  onClick={(e) => {
                    stopActionEvent(e);
                    handleDeleteRequest(threadId);
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 w-full h-full border-0 cursor-pointer"
                  style={{
                    background: DELETE_BG,
                    color: '#fff',
                    padding: 8,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 44,
                  }}
                  aria-label="Delete"
                >
                  <Trash2 size={22} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                    Delete
                  </span>
                </button>
              );

              const rowContent = (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open chat with ${name}`}
                  className="flex items-center gap-3 active:opacity-90 transition-opacity w-full text-left"
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    minHeight: 76,
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.muted }}
                  >
                    {(name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isPinned && <Pin size={12} style={{ color: colors.muted, flexShrink: 0 }} />}
                      <span
                        className="truncate font-semibold"
                        style={{ fontSize: 15, fontWeight: 600, color: colors.text }}
                      >
                        {name}
                      </span>
                      {unreadCount > 0 && (
                        <span
                          className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: colors.primary, color: '#fff' }}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <p
                      className="truncate"
                      style={{ fontSize: 13, color: colors.muted, lineHeight: 1.3 }}
                    >
                      {lastMessage}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {timeLabel ? (
                      <span style={{ fontSize: 12, color: colors.muted }}>{timeLabel}</span>
                    ) : null}
                    <ChevronRight size={18} style={{ color: colors.muted }} aria-hidden />
                  </div>
                </div>
              );

              return (
                <SwipeRow
                  key={threadId}
                  id={threadId}
                  isOpenLeft={openRowId === threadId && openSide === 'left'}
                  isOpenRight={openRowId === threadId && openSide === 'right'}
                  onOpenLeft={handleOpenLeft}
                  onOpenRight={handleOpenRight}
                  onClose={handleClose}
                  onSwipeStart={handleSwipeStart}
                  onRowPress={() => handleRow(clientId)}
                  leftActions={leftActions}
                  rightActions={rightActions}
                  isDeleting={deletingId === threadId}
                  onDeleteAnimationEnd={() => handleDeleteAnimationEnd(threadId)}
                >
                  <Card
                    style={{
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: `1px solid ${colors.border}`,
                      background: colors.surface1,
                      marginBottom: 10,
                      padding: 0,
                    }}
                  >
                    {rowContent}
                  </Card>
                </SwipeRow>
              );
            }) : null}
          </div>
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
        </div>
      )}

      {startConversationOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Start conversation"
        >
          <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: colors.border }}>
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Choose client</h2>
            <button type="button" onClick={() => { setStartConversationOpen(false); setClientSearch(''); }} className="text-sm font-medium" style={{ color: colors.accent }}>Cancel</button>
          </div>
          <div className="flex-shrink-0 px-4 py-2 border-b" style={{ borderColor: colors.border }}>
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
              <div className="px-4 py-8 flex flex-col items-center text-center gap-3">
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
                  }}
                >
                  {clientSearch.trim() ? 'Clear search' : 'Go to Clients'}
                </button>
              </div>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c?.id}
                  type="button"
                  onClick={() => handleStartConversation(c)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 active:opacity-80 border-b"
                  style={{ borderColor: colors.border, color: colors.text }}
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
    </div>
  );
}
