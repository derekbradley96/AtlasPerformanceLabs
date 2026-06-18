import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { useData } from '@/data/useData';
import { useQuery } from '@tanstack/react-query';
import SegmentedControl from '@/ui/SegmentedControl';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase } from '@/lib/supabaseClient';
import { getMessagesListPath, navigateToThread } from '@/lib/messagesPath';

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'messages', label: 'Messages' },
];

const REVIEW_TYPES = new Set([
  'CHECKIN_REVIEW',
  'POSING_SUBMISSION_REVIEW',
  'MISSING_MANDATORY_POSES',
  'PEAK_WEEK_DUE',
  'SHOW_WEEK_CHECKLIST_DUE',
]);

function getSubmittedAt(item) {
  return (
    item?.createdAt ||
    item?.created_at ||
    item?.occurred_at ||
    item?.raw?.created_at ||
    item?.raw?.submitted_at ||
    null
  );
}

function waitingLabel(ts) {
  if (!ts) return 'Waiting now';
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'Waiting now';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.round(hours / 24);
  return `${days}d waiting`;
}

function timeAgoShort(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  if (hrs < 48) return 'Yesterday';
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function classify(item) {
  if (item?.lane === 'messages' || item?.type === 'MESSAGE_THREAD') return 'messages';
  if (item?.lane === 'reviews') return 'reviews';
  if (item?.type === 'UNREAD_MESSAGE') return 'messages';
  if (REVIEW_TYPES.has(item?.type) || String(item?.type || '').includes('REVIEW')) return 'reviews';
  return 'other';
}

export default function InboxPage() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const data = useData();
  const [segment, setSegment] = useState('all');
  const [reviewItems, setReviewItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const isCoachInbox = normalizeRole(role) === 'coach';
  const supabase = getSupabase();

  const { data: coachClients = [] } = useQuery({
    queryKey: ['inbox-clients', user?.id],
    queryFn: async () => {
      const list = await data.listClients();
      return Array.isArray(list) ? list : [];
    },
    enabled: !!user?.id && isCoachInbox,
    staleTime: 60000,
  });

  const { data: messageThreads = [] } = useQuery({
    queryKey: ['inbox-message-threads', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return [];
      const { data } = await supabase
        .from('message_threads')
        .select(`
          id, client_id, updated_at, coach_last_read_at, client_last_read_at,
          message_messages(
            id, message_text, sender_role, created_at, message_type
          )
        `)
        .eq('coach_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id && !!supabase && isCoachInbox,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!isCoachInbox) return;
    let cancelled = false;
    setLoading(true);
    data.listReviewItems().then((result) => {
      if (cancelled) return;
      const active = Array.isArray(result?.active) ? result.active : [];
      setReviewItems(active);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setReviewItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data, isCoachInbox]);

  const clientNameById = useMemo(() => {
    const m = new Map();
    (coachClients || []).forEach((c) => {
      if (!c?.id) return;
      m.set(c.id, c.full_name || c.name || 'Client');
    });
    return m;
  }, [coachClients]);

  const messageConversationItems = useMemo(() => {
    return (messageThreads || []).map((t) => {
      const lastCoachRead = t?.coach_last_read_at ? new Date(t.coach_last_read_at) : new Date(0);
      const messages = Array.isArray(t?.message_messages) ? [...t.message_messages] : [];
      const unread = messages.filter((m) =>
        m?.sender_role !== 'coach' &&
        new Date(m.created_at).getTime() > lastCoachRead.getTime()
      ).length;
      const lastMsg = messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        id: `msg-${t.id}`,
        itemKey: `msg-${t.id}`,
        type: 'MESSAGE_THREAD',
        lane: 'messages',
        threadId: t.id,
        clientId: t.client_id,
        unread_count: unread,
        title: clientNameById.get(t.client_id) || 'Client',
        message_text: lastMsg?.message_text || '',
        subtitle: lastMsg?.message_text || 'Open thread to reply.',
        created_at: lastMsg?.created_at || t.updated_at,
      };
    });
  }, [messageThreads, clientNameById]);

  const allItems = useMemo(() => {
    return [...reviewItems, ...messageConversationItems]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [reviewItems, messageConversationItems]);

  const normalized = useMemo(() => {
    return [...allItems]
      .map((item) => ({ ...item, lane: classify(item), submittedAt: getSubmittedAt(item) }))
      .sort((a, b) => {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return ta - tb;
      });
  }, [allItems]);

  const filtered = useMemo(() => {
    if (segment === 'all') {
      return normalized.filter((item) => item.lane === 'reviews' || item.lane === 'messages');
    }
    return normalized.filter((item) => item.lane === segment);
  }, [normalized, segment]);

  const reviewCount = normalized.filter((item) => item.lane === 'reviews').length;
  const unreadMessageCount = normalized.filter((item) => item.lane === 'messages' && (item.unread_count || 0) > 0).length;

  if (!isCoachInbox) {
    return (
      <div className="app-screen" style={{ padding: spacing[16] }}>
        <Card style={{ padding: spacing[16] }}>
          <p style={{ color: colors.muted }}>Inbox is for coaches only.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-screen" style={{ paddingBottom: spacing[24] }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
        <div className="min-w-0 flex-1">
          <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
        </div>
        <Button
          variant="primary"
          className="w-full shrink-0 sm:w-auto sm:self-center"
          onClick={() => navigate(`${getMessagesListPath()}?compose=1`)}
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          New message
        </Button>
      </div>
      <Card style={{ marginTop: spacing[12], marginBottom: spacing[12], padding: spacing[12] }}>
        <p className="text-sm" style={{ color: colors.text }}>
          {unreadMessageCount + reviewCount} items need a reply now
        </p>
        <p className="text-xs mt-1" style={{ color: colors.muted }}>
          {reviewCount} reviews waiting · {unreadMessageCount} unread messages
        </p>
      </Card>

      {loading ? (
        <Card style={{ padding: spacing[16] }}>
          <p style={{ color: colors.muted }}>Loading inbox…</p>
        </Card>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <Card style={{ padding: spacing[16] }}>
          <p className="text-sm font-medium" style={{ color: colors.text }}>All caught up.</p>
          <p className="text-xs mt-1" style={{ color: colors.muted }}>No items are waiting for a reply.</p>
        </Card>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isMessage = item.lane === 'messages';
            if (item.type === 'MESSAGE_THREAD') {
              return (
                <Card
                  key={item.id}
                  onClick={() => navigateToThread(navigate, item.clientId, {
                    state: item.title ? { clientName: item.title } : undefined,
                  })}
                  style={{ cursor: 'pointer', padding: spacing[12] }}
                >
                  <div style={{ display: 'flex', gap: spacing[10], alignItems: 'flex-start' }}>
                    <MessageSquare size={16} style={{ color: colors.primary, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: 0, flex: 1, minWidth: 0 }}>
                          {item.title || 'Client'}
                        </p>
                        <span style={{ fontSize: 11, color: colors.muted, whiteSpace: 'nowrap' }}>
                          {timeAgoShort(item.created_at)}
                        </span>
                        {item.unread_count > 0 ? (
                          <span
                            style={{
                              minWidth: 20,
                              height: 20,
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              background: colors.primary,
                              color: '#fff',
                              padding: '0 6px',
                            }}
                          >
                            {item.unread_count > 9 ? '9+' : item.unread_count}
                          </span>
                        ) : null}
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: colors.muted,
                          margin: 0,
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.message_text || 'Open thread to reply.'}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            }
            const primaryLabel = isMessage ? 'Reply ->' : 'Review ->';
            return (
              <Card key={item.itemKey || `${item.type}-${item.clientId || item.title}`} style={{ padding: spacing[12] }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                      {item.title || 'Client update'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: colors.muted }}>
                      {isMessage ? 'Message' : 'Review'} · {waitingLabel(item.submittedAt)}
                    </p>
                    <p className="text-sm mt-2" style={{ color: colors.text }}>
                      {item.subtitle || item.why || 'Open this item to take action.'}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (item.actionRoute) {
                        navigate(item.actionRoute);
                        return;
                      }
                      if (isMessage && item.clientId) {
                        navigateToThread(navigate, item.clientId, {
                          state: item.title ? { clientName: item.title } : undefined,
                        });
                        return;
                      }
                      if (!isMessage && item.clientId) {
                        navigate(`/clients/${item.clientId}/review-center`);
                        return;
                      }
                      navigate(isMessage ? getMessagesListPath() : '/review-center');
                    }}
                  >
                    {primaryLabel}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
