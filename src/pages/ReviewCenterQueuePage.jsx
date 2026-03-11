/**
 * Unified Review Center queue: one list from v_coach_review_queue, sorted by priority desc.
 * Each item type has an actionable tray: checkin, pose_check, retention_risk, billing_overdue, flag.
 * Check-in items show an Atlas insight snippet from generateCheckinSummary (atlasInsights.js).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { ClipboardCheck } from 'lucide-react';
import { markCheckinReviewed } from '@/lib/checkins';
import { savePoseCheckReview } from '@/lib/poseChecks';
import { generateCheckinSummary } from '@/lib/atlasInsights';
import { useAuth } from '@/lib/AuthContext';
import ReviewActionTray, { PAYMENT_REMINDER_MSG } from '@/components/review/ReviewActionTray';
import { FileCheck, MessageCircle, Flag, Check, ImageIcon, CalendarClock, DollarSign, User } from 'lucide-react';

/** coach_focus from profile; default 'transformation' if missing. */
function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

/** Item types hidden for transformation coaches (pose/peak/contest prep). Competition/integrated see all. */
const TRANSFORMATION_EXCLUDED_ITEM_TYPES = ['pose_check', 'peak_week_due', 'contest_prep'];

const ITEM_TYPE_LABELS = {
  checkin: 'Check-in',
  pose_check: 'Pose check',
  peak_week_due: 'Peak week due',
  contest_prep: 'Contest prep',
  retention_risk: 'Retention risk',
  billing_overdue: 'Billing overdue',
  flag: 'Active flags',
  momentum_dropping: 'Client momentum dropping',
};

/** Filter tabs: value for URL, label, hide for transformation. */
const FILTER_OPTIONS = [
  { value: null, label: 'All' },
  { value: 'checkin', label: 'Check-ins' },
  { value: 'pose_check', label: 'Pose Checks', hideForTransformation: true },
  { value: 'retention_risk', label: 'Retention' },
  { value: 'billing_overdue', label: 'Billing' },
  { value: 'flag', label: 'Flags' },
  { value: 'momentum_dropping', label: 'Momentum' },
];

const SORT_OPTIONS = [
  { value: 'priority', label: 'Highest priority' },
  { value: 'newest', label: 'Newest' },
  { value: 'client', label: 'Client name' },
];

function formatCreatedAt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

/** Fetch unified queue for current coach. */
async function fetchReviewQueue(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_coach_review_queue')
      .select('coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at')
      .eq('coach_id', coachId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

/** Dismiss a queue item (retention_risk, billing_overdue, flag, momentum_dropping) by inserting into review_queue_dismissals. */
async function dismissQueueItem(coachId, clientId, itemType) {
  if (!hasSupabase || !coachId || !clientId || !['retention_risk', 'billing_overdue', 'flag', 'momentum_dropping'].includes(itemType)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('review_queue_dismissals').upsert(
      { coach_id: coachId, client_id: clientId, item_type: itemType, resolved_at: new Date().toISOString() },
      { onConflict: 'coach_id,client_id,item_type', ignoreDuplicates: false }
    );
    return !error;
  } catch (_) {
    return false;
  }
}

export default function ReviewCenterQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, coachFocus: coachFocusFromAuth } = useAuth();
  const filterType = searchParams.get('filter') || null;
  const sortBy = searchParams.get('sort') || 'priority';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [coachId, setCoachId] = useState(null);

  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const isTransformation = coachFocus === 'transformation';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSupabase) {
        setLoading(false);
        return;
      }
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user?.id) {
        setLoading(false);
        return;
      }
      setCoachId(user.id);
      let list = await fetchReviewQueue(user.id);
      if (isTransformation) {
        list = (list || []).filter((item) => !TRANSFORMATION_EXCLUDED_ITEM_TYPES.includes(item.item_type));
      }
      if (!cancelled) {
        setItems(list || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isTransformation]);

  const handleResolve = async (item) => {
    const key = `${item.client_id}-${item.item_type}-${item.payload?.checkin_id || item.payload?.pose_check_id || ''}`;
    setResolvingId(key);
    try {
      let ok = false;
      if (item.item_type === 'checkin' && item.payload?.checkin_id) {
        ok = await markCheckinReviewed(item.payload.checkin_id);
      } else if (item.item_type === 'pose_check' && item.payload?.pose_check_id) {
        ok = await savePoseCheckReview(item.payload.pose_check_id, {});
      } else if (['retention_risk', 'billing_overdue', 'flag', 'momentum_dropping'].includes(item.item_type) && coachId) {
        ok = await dismissQueueItem(coachId, item.client_id, item.item_type);
      }
      if (ok) {
        if (item.item_type === 'checkin' && item.payload?.checkin_id) {
          const { trackCheckinReviewed } = await import('@/services/analyticsService');
          trackCheckinReviewed({ checkin_id: item.payload.checkin_id, client_id: item.client_id });
        }
        toast.success('Marked resolved');
        const next = await fetchReviewQueue(coachId);
        setItems(next);
      } else {
        toast.error('Could not resolve');
      }
    } finally {
      setResolvingId(null);
    }
  };

  const unresolved = useMemo(() => {
    const list = items
      .filter((i) => !i.resolved_at)
      .filter((i) => !filterType || i.item_type === filterType);
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortBy === 'client') {
      list.sort((a, b) => (a.client_name || '').localeCompare(b.client_name || '', undefined, { sensitivity: 'base' }));
    } else {
      list.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return list;
  }, [items, filterType, sortBy]);

  const checkinQueueItems = useMemo(
    () => unresolved.filter((i) => i.item_type === 'checkin' && i.payload?.checkin_id),
    [unresolved]
  );
  const checkinIds = useMemo(() => checkinQueueItems.map((i) => i.payload.checkin_id), [checkinQueueItems]);
  const clientIdsForTrends = useMemo(() => [...new Set(checkinQueueItems.map((i) => i.client_id).filter(Boolean))], [checkinQueueItems]);

  const { data: checkinsFetched = [] } = useQuery({
    queryKey: ['review-queue-checkins', checkinIds],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || checkinIds.length === 0) return [];
      const { data, error } = await getSupabase().from('checkins').select('*').in('id', checkinIds);
      return error ? [] : (Array.isArray(data) ? data : []);
    },
    enabled: checkinIds.length > 0,
  });
  const { data: trendsByClient = {} } = useQuery({
    queryKey: ['review-queue-trends', clientIdsForTrends],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || clientIdsForTrends.length === 0) return {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('v_client_progress_trends')
        .select('*')
        .in('client_id', clientIdsForTrends)
        .order('submitted_at', { ascending: true });
      if (error || !Array.isArray(data)) return {};
      const byClient = {};
      for (const row of data) {
        if (!row.client_id) continue;
        if (!byClient[row.client_id]) byClient[row.client_id] = [];
        byClient[row.client_id].push(row);
      }
      return byClient;
    },
    enabled: clientIdsForTrends.length > 0,
  });

  const checkinsById = useMemo(() => {
    const map = {};
    for (const c of checkinsFetched) if (c?.id) map[c.id] = c;
    return map;
  }, [checkinsFetched]);

  const insightByItemKey = useMemo(() => {
    const map = {};
    for (const item of checkinQueueItems) {
      const checkinId = item.payload?.checkin_id;
      const clientId = item.client_id;
      const checkin = checkinsById[checkinId];
      if (!checkin) continue;
      const clientTrends = trendsByClient[clientId] || [];
      const previousTrends = clientTrends.filter(
        (t) => t.submitted_at && checkin.submitted_at && new Date(t.submitted_at) < new Date(checkin.submitted_at)
      );
      const result = generateCheckinSummary(checkin, previousTrends.length > 0 ? previousTrends : null);
      const key = `${item.client_id}-${item.item_type}-${checkinId}`;
      map[key] = result.summary;
    }
    return map;
  }, [checkinQueueItems, checkinsById, trendsByClient]);

  const visibleFilters = FILTER_OPTIONS.filter((f) => !f.hideForTransformation || !isTransformation);

  const setFilter = (value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('filter', value);
      else next.delete('filter');
      return next;
    }, { replace: true });
  };

  const setSort = (value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'priority') next.set('sort', value);
      else next.delete('sort');
      return next;
    }, { replace: true });
  };

  function getActionsForItem(item) {
    const payload = item.payload || {};
    const clientId = item.client_id;
    const key = `${item.client_id}-${item.item_type}-${item.payload?.checkin_id || item.payload?.pose_check_id || ''}`;
    const resolving = resolvingId === key;

    const navMessages = () => { if (clientId) navigate(`/messages/${clientId}`); else toast.error('Client not found'); };
    const navClient = () => { if (clientId) navigate(`/clients/${clientId}`); else toast.error('Client not found'); };
    const navCheckin = () => { if (payload.checkin_id) navigate(`/review-center/checkins/${payload.checkin_id}`); else navClient(); };
    const navPoseCheck = () => { if (payload.pose_check_id) navigate(`/review-center/pose-checks/${payload.pose_check_id}`); else navigate('/review-center/pose-checks'); };
    const sendPaymentReminder = () => { if (clientId) navigate(`/messages/${clientId}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } }); else toast.error('Client not found'); };
    const openEarnings = () => navigate('/earnings');
    const scheduleFollowUp = () => toast.info('Schedule follow-up — coming soon');
    const addFlag = () => { navClient(); toast.info('Add flag from client profile'); };

    switch (item.item_type) {
      case 'checkin':
        return [
          { label: 'Review Check-In', onClick: navCheckin, primary: true, icon: <FileCheck size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Add Flag', onClick: addFlag, icon: <Flag size={16} /> },
          { label: 'Mark Reviewed', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'pose_check':
        return [
          { label: 'Review Pose Check', onClick: navPoseCheck, primary: true, icon: <ImageIcon size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Mark Reviewed', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'retention_risk':
        return [
          { label: 'Message Client', onClick: navMessages, primary: true, icon: <MessageCircle size={16} /> },
          { label: 'Schedule Follow-Up', onClick: scheduleFollowUp, icon: <CalendarClock size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'billing_overdue':
        return [
          { label: 'Send Payment Reminder', onClick: sendPaymentReminder, primary: true, icon: <MessageCircle size={16} /> },
          { label: 'Open Money Dashboard', onClick: openEarnings, icon: <DollarSign size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'flag':
        return [
          { label: 'View Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Resolve Flag', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'momentum_dropping':
        return [
          { label: 'View Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      default:
        return [
          { label: 'View Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Review Center" onBack={() => navigate(-1)} />
        <div style={{ ...pageContainer, paddingTop: spacing[24] }}>
          <div className="animate-pulse rounded-xl" style={{ ...standardCard, padding: spacing[24], minHeight: 200 }}>
            <div style={{ height: 16, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
            <div style={{ height: 12, width: '90%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
            <div style={{ height: 12, width: '70%', background: colors.surface2, borderRadius: 6 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Review Center" onBack={() => navigate(-1)} />
      <div style={{ ...pageContainer, paddingBottom: spacing[8] }}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {visibleFilters.map((opt) => {
            const active = (filterType || null) === opt.value;
            return (
              <button
                key={opt.value ?? 'all'}
                type="button"
                onClick={() => setFilter(opt.value)}
                style={{
                  padding: `${spacing[6]}px ${spacing[12]}px`,
                  borderRadius: shell.cardRadius,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${active ? colors.primary : shell.cardBorder}`,
                  background: active ? colors.primarySubtle : 'transparent',
                  color: active ? colors.primary : colors.text,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: colors.muted }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSort(e.target.value)}
            style={{
              padding: `${spacing[6]}px ${spacing[10]}px`,
              borderRadius: 8,
              fontSize: 13,
              background: colors.surface2,
              border: `1px solid ${shell.cardBorder}`,
              color: colors.text,
              cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ paddingTop: spacing[8], paddingBottom: spacing[32] }}>
        {unresolved.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="No check-ins or pose checks are waiting for review. New items will appear here when clients submit."
            icon={ClipboardCheck}
            actionLabel="View clients"
            onAction={() => navigate('/clients')}
          />
        ) : (
          <ul className="space-y-3">
            {unresolved.map((item) => {
              const key = `${item.client_id}-${item.item_type}-${(item.payload?.checkin_id || item.payload?.pose_check_id || item.created_at) || ''}`;
              const atlasInsight = item.item_type === 'checkin' && item.payload?.checkin_id ? insightByItemKey[key] : null;
              return (
                <Card key={key} style={{ ...standardCard, padding: spacing[16] }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate" style={{ color: colors.text }}>
                        {item.client_name || 'Client'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: colors.border, color: colors.muted }}
                        >
                          {ITEM_TYPE_LABELS[item.item_type] || item.item_type}
                        </span>
                        {(item.reasons || []).length > 0 && (
                          <span className="text-xs" style={{ color: colors.muted }}>
                            {(item.reasons || []).join(' · ')}
                          </span>
                        )}
                      </div>
                      {atlasInsight && (
                        <p className="text-xs mt-1.5" style={{ color: colors.muted, fontStyle: 'italic' }}>
                          Atlas: {atlasInsight}
                        </p>
                      )}
                      {item.item_type === 'momentum_dropping' && item.payload?.total_score != null && (
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          Momentum score: {Math.round(Number(item.payload.total_score))}/100
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: colors.muted }}>
                        {formatCreatedAt(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <ReviewActionTray actions={getActionsForItem(item)} style={{ marginTop: spacing[12], paddingTop: spacing[12] }} />
                </Card>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
