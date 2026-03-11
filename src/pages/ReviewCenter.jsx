import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Award, Image, MessageSquare, Check, ChevronRight, DollarSign, FileText } from 'lucide-react';
import { getClientById } from '@/data/selectors';
import { getClientPhase } from '@/lib/clientPhaseStore';
import { getClientReviewFeed } from '@/features/reviewEngine/getClientReviewFeed';
import { getClients } from '@/data/clientsService';
import { getLatestByClientIds } from '@/data/checkInsService';
import { safeFormatDate } from '@/lib/format';
import SegmentedControl from '@/ui/SegmentedControl';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { impactLight } from '@/lib/haptics';
import { useAuth } from '@/lib/AuthContext';
import { listReviewItems, completeReviewItem } from '@/lib/supabaseStripeApi';
import { toast } from 'sonner';

const SEGMENTS = [
  { key: 'active', label: 'Active' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'done', label: 'Done' },
];

const FILTER_CHIPS = [
  { key: null, label: 'All' },
  { key: 'checkin', label: 'Check-ins' },
  { key: 'posing', label: 'Posing' },
  { key: 'photo', label: 'Photos' },
];

function formatSegmentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(items) {
  const groups = new Map();
  for (const item of items) {
    const key = (item.createdAt || '').slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (b || '').localeCompare(a || ''))
    .map(([date, list]) => ({ date, list }));
}

function ReviewCenterAll({ navigate, userId }) {
  const trainerId = userId || 'local-trainer';
  const [clientsList, setClientsList] = useState([]);
  const [latestCheckinsMap, setLatestCheckinsMap] = useState({});
  const [loadingClients, setLoadingClients] = useState(true);
  const [stripeItems, setStripeItems] = useState([]);
  const [loadingStripe, setLoadingStripe] = useState(!!userId);

  useEffect(() => {
    let cancelled = false;
    setLoadingClients(true);
    (async () => {
      try {
        const clients = await getClients(trainerId);
        const list = Array.isArray(clients) ? clients : [];
        if (cancelled) return;
        setClientsList(list);
        const ids = list.map((c) => c?.id).filter(Boolean);
        if (ids.length === 0) {
          setLatestCheckinsMap({});
          return;
        }
        const map = await getLatestByClientIds(trainerId, ids);
        if (!cancelled) setLatestCheckinsMap(typeof map === 'object' && map !== null ? map : {});
      } catch {
        if (!cancelled) {
          setClientsList([]);
          setLatestCheckinsMap({});
        }
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trainerId]);

  useEffect(() => {
    if (!userId) {
      setLoadingStripe(false);
      return;
    }
    (async () => {
      const { items } = await listReviewItems(userId, { status: 'active' });
      setStripeItems(Array.isArray(items) ? items : []);
    })().finally(() => setLoadingStripe(false));
  }, [userId]);

  const handleMarkPaid = useCallback(async (itemId) => {
    await impactLight();
    const { error } = await completeReviewItem(itemId);
    if (error) toast.error(error);
    else {
      toast.success('Marked as paid');
      setStripeItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  }, []);

  const hasStripeItems = Array.isArray(stripeItems) && stripeItems.length > 0;
  const clients = Array.isArray(clientsList) ? clientsList : [];
  const loading = loadingClients || loadingStripe;

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
        background: colors.bg,
        color: colors.text,
      }}
    >
      <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>Review Center</h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>Clients with items needing review</p>

      {hasStripeItems && (
        <section style={{ marginBottom: spacing[20] }}>
          <p className="text-[13px] font-semibold mb-2" style={{ color: colors.muted }}>Payment & intake</p>
          <div className="space-y-2">
            {stripeItems.map((item) => (
              <Card key={item.id} style={{ padding: spacing[12] }}>
                <div className="flex items-center gap-2 mb-2">
                  {item.type === 'payment_overdue' ? <DollarSign size={18} style={{ color: colors.destructive }} /> : <FileText size={18} style={{ color: colors.accent }} />}
                  <span className="text-sm font-medium" style={{ color: colors.text }}>
                    {item.type === 'payment_overdue' ? 'Payment overdue' : 'Intake required'}
                  </span>
                </div>
                <p className="text-[13px] mb-3" style={{ color: colors.muted }}>{item.client_name ?? 'Client'}</p>
                <div className="flex flex-wrap gap-2">
                  {item.client_id && (
                    <Button
                      variant="secondary"
                      onClick={async () => { await impactLight(); navigate(`/messages/${item.client_id}`); }}
                    >
                      <MessageSquare size={14} style={{ marginRight: 6 }} /> Send reminder
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => handleMarkPaid(item.id)}
                  >
                    <Check size={14} style={{ marginRight: 6 }} /> Mark paid (manual)
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {loading && clients.length === 0 && (
        <div className="flex items-center justify-center" style={{ marginTop: spacing[24], minHeight: 80 }}>
          <div className="w-8 h-8 border-2 border-white/20 border-t-current rounded-full animate-spin" style={{ borderTopColor: colors.accent }} />
        </div>
      )}

      {!loading && clients.length > 0 && (
        <section>
          <p className="text-[13px] font-semibold mb-2" style={{ color: colors.muted }}>Clients & latest check-in</p>
          <div className="space-y-2">
            {clients.map((client) => {
              const clientId = client?.id;
              const clientName = client?.full_name ?? client?.name ?? 'Client';
              const latest = clientId != null ? (latestCheckinsMap[clientId] ?? null) : null;
              const statusLabel = latest?.checkin_date ? safeFormatDate(latest.checkin_date) : 'No check-in yet';
              const statusWaiting = !latest;

              return (
                <button
                  key={clientId ?? 'no-id'}
                  type="button"
                  onClick={async () => { await impactLight(); if (clientId) navigate(`/clients/${clientId}/review-center`); }}
                  className="w-full flex items-center justify-between text-left rounded-xl active:opacity-90"
                  style={{
                    padding: spacing[16],
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    minHeight: touchTargetMin,
                  }}
                >
                  <span className="font-medium">{clientName}</span>
                  <span className="text-sm" style={{ color: statusWaiting ? colors.muted : colors.text }}>
                    {statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !hasStripeItems && clients.length === 0 && (
        <EmptyState icon={Check} title="You're clear." subtext="No clients yet. Add clients to see check-ins and review items here." />
      )}
    </div>
  );
}

function ReviewCard({ item, onReview, onMessage, onMarkReviewed }) {
  const navigate = useNavigate();
  const typeIcon = item.type === 'checkin' ? ClipboardList : item.type === 'posing' ? Award : Image;
  const typeLabel = item.type === 'checkin' ? 'Check-in' : item.type === 'posing' ? 'Posing' : 'Photos';
  const badgeColor = item.type === 'checkin' ? 'rgba(59,130,246,0.2)' : item.type === 'posing' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)';
  const badgeTextColor = item.type === 'checkin' ? '#3B82F6' : item.type === 'posing' ? '#EAB308' : '#22C55E';

  const handleReview = useCallback(async () => {
    await impactLight();
    onReview?.(item);
  }, [item, onReview]);

  return (
    <Card style={{ marginBottom: spacing[12], padding: spacing[16] }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 4 }}>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: badgeColor, color: badgeTextColor }}>
              {typeLabel}
            </span>
            {item.status === 'reviewed' && (
              <span className="text-xs" style={{ color: colors.success }}>Reviewed</span>
            )}
          </div>
          <p className="text-[13px]" style={{ color: colors.muted, marginBottom: 4 }}>
            {item.subtitle || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs" style={{ color: colors.muted }}>
            {item.summaryLines.slice(0, 4).map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleReview}
          className="flex-shrink-0 flex items-center justify-center rounded-lg active:opacity-80"
          style={{ minWidth: 44, minHeight: 44, background: 'rgba(255,255,255,0.08)', color: colors.accent }}
          aria-label="Review"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      {item.status === 'needs_review' && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          <Button variant="secondary" onClick={handleReview} style={{ flex: 1, minWidth: 0 }}>
            Review
          </Button>
          <Button
            variant="secondary"
            onClick={async () => { await impactLight(); onMessage?.(item); }}
            style={{ flex: 1, minWidth: 0 }}
          >
            <MessageSquare size={16} style={{ marginRight: 6 }} /> Message
          </Button>
          {onMarkReviewed && (
            <Button
              variant="secondary"
              onClick={async () => { await impactLight(); onMarkReviewed?.(item); }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Check size={16} style={{ marginRight: 6 }} /> Mark reviewed
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ReviewCenter() {
  const { id: clientId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const userId = isDemoMode ? 'demo-trainer' : (user?.id ?? '');
  const filterFromUrl = searchParams.get('filter');
  const [segment, setSegment] = useState('active');
  const [filterType, setFilterType] = useState(() => filterFromUrl || null);
  React.useEffect(() => {
    if (filterFromUrl && ['checkin', 'posing', 'photo'].includes(filterFromUrl)) setFilterType(filterFromUrl);
  }, [filterFromUrl]);

  const client = clientId ? getClientById(clientId) : null;
  const phase = clientId && client ? getClientPhase(clientId, client) : (client?.phase || '—');
  const statusPillLabel = phase === 'PEAK_WEEK' || (client?.prepPhase === 'PEAK_WEEK') ? 'Peak week' : client?.status === 'at_risk' || client?.status === 'attention' ? 'At risk' : 'On track';
  const statusPillColor = statusPillLabel === 'Peak week' ? '#8B5CF6' : statusPillLabel === 'At risk' ? '#EF4444' : '#22C55E';

  const feed = useMemo(
    () => (clientId ? getClientReviewFeed(clientId, { status: segment, filterType }) : []),
    [clientId, segment, filterType]
  );
  const grouped = useMemo(() => groupByDate(feed), [feed]);
  const isEmpty = feed.length === 0;

  const handleReview = useCallback(
    (item) => {
      navigate(`/review/${item.type}/${encodeURIComponent(item.id)}?clientId=${encodeURIComponent(item.clientId)}`);
    },
    [navigate]
  );
  const handleMessage = useCallback(
    (item) => {
      navigate(`/messages/${item.clientId}`, { state: { prefilledMessage: '' } });
    },
    [navigate]
  );
  const handleMarkReviewed = useCallback(
    (item) => {
      navigate(`/review/${item.type}/${encodeURIComponent(item.id)}?clientId=${encodeURIComponent(item.clientId)}`);
    },
    [navigate]
  );

  // Global Review Center (no clientId): list clients with review items + payment/intake
  if (!clientId) {
    return <ReviewCenterAll navigate={navigate} userId={userId} />;
  }

  if (!client) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8 app-screen" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Client not found.</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div style={{ marginBottom: spacing[16] }}>
        <h1 className="text-[22px] font-semibold" style={{ color: colors.text, marginBottom: 4 }}>
          {client.full_name || 'Client'}
        </h1>
        <span
          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium text-white"
          style={{ background: statusPillColor }}
        >
          {statusPillLabel}
        </span>
      </div>

      <SegmentedControl
        options={SEGMENTS}
        value={segment}
        onChange={async (k) => { await impactLight(); setSegment(k); }}
      />
      <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[12], marginBottom: spacing[16] }}>
        {FILTER_CHIPS.map(({ key, label }) => {
          const active = filterType === key;
          return (
            <button
              key={key ?? 'all'}
              type="button"
              onClick={async () => { await impactLight(); setFilterType(key); }}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium border-none"
              style={{
                background: active ? colors.accent : 'rgba(255,255,255,0.08)',
                color: active ? '#fff' : colors.muted,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isEmpty && (
        <EmptyState
          icon={Check}
          title={
            segment === 'active' ? "You're clear." :
            segment === 'waiting' ? 'Nothing waiting.' :
            'No completed reviews yet.'
          }
          subtext={
            segment === 'active'
              ? 'No check-ins, posing submissions, or photos needing review for this client.'
              : segment === 'waiting'
                ? "Scheduled or not-yet-due items will appear here."
                : 'Reviewed items will appear here.'
          }
        />
      )}

      {!isEmpty && (
        <div className="space-y-6">
          {grouped.map(({ date, list }) => (
            <section key={date}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                {formatSegmentDate(date)}
              </p>
              {list.map((item) => (
                <ReviewCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onReview={handleReview}
                  onMessage={handleMessage}
                  onMarkReviewed={handleMarkReviewed}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
