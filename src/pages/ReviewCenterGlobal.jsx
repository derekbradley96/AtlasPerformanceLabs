import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { shouldShowModule } from '@/lib/coachFocus';
import { timeAgo } from '@/lib/timeAgo';
import { buildTrainerQueue, setQueueItemState } from '@/lib/reviewQueue';
import { getTrainerSilentMode } from '@/lib/trainerPreferencesStorage';
import { isCriticalQueueItem } from '@/lib/silentMode/silentModeRules';
import SegmentedControl from '@/ui/SegmentedControl';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { getDaysOut } from '@/lib/intelligence/daysOut';
import HealthBreakdownSheet from '@/components/health/HealthBreakdownSheet';
import { useHealthScore } from '@/components/health/useHealthScore';

const SEGMENTS = [
  { key: 'active', label: 'Active' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'done', label: 'Done' },
];

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'comp_prep', label: 'Comp Prep' },
  { key: 'payments', label: 'Payments' },
  { key: 'messages', label: 'Messages' },
  { key: 'leads', label: 'Leads' },
  { key: 'retention', label: 'Retention' },
];

const STATUS_MAP = { active: 'ACTIVE', waiting: 'WAITING', done: 'DONE' };

const FILTER_TYPES = {
  all: null,
  critical: null,
  reviews: ['CHECKIN_REVIEW', 'POSING_REVIEW'],
  comp_prep: ['POSING_REVIEW', 'PEAK_WEEK_DUE', 'MISSING_MANDATORY_POSES'],
  payments: ['PAYMENT_OVERDUE'],
  messages: ['UNREAD_MESSAGES'],
  leads: ['NEW_LEAD'],
  retention: ['RETENTION_RISK'],
};

function typeLabelAndStyle(type) {
  switch (type) {
    case 'CHECKIN_REVIEW':
      return { label: 'Review', bg: 'rgba(59,130,246,0.2)', color: '#3B82F6' };
    case 'POSING_REVIEW':
      return { label: 'Posing', bg: 'rgba(234,179,8,0.2)', color: '#EAB308' };
    case 'PEAK_WEEK_DUE':
      return { label: 'Peak week', bg: 'rgba(139,92,246,0.2)', color: '#8B5CF6' };
    case 'MISSING_MANDATORY_POSES':
      return { label: 'Missing poses', bg: 'rgba(245,158,11,0.2)', color: '#F59E0B' };
    case 'PAYMENT_OVERDUE':
      return { label: 'Payment', bg: 'rgba(239,68,68,0.2)', color: '#EF4444' };
    case 'UNREAD_MESSAGES':
      return { label: 'Messages', bg: 'rgba(34,197,94,0.2)', color: '#22C55E' };
    case 'NEW_LEAD':
      return { label: 'Lead', bg: 'rgba(34,197,94,0.2)', color: '#22C55E' };
    case 'RETENTION_RISK':
      return { label: 'Retention', bg: 'rgba(239,68,68,0.2)', color: '#EF4444' };
    default:
      return { label: type ?? 'Item', bg: 'rgba(255,255,255,0.08)', color: colors.muted };
  }
}

function GlobalReviewCard({ item, onReview, onOpenClient, onMarkReviewed, onOpenHealth }) {
  const { label, bg, color } = typeLabelAndStyle(item.type);
  const hasReviewFlow = item.type === 'CHECKIN_REVIEW' || item.type === 'POSING_REVIEW';
  const healthScore = item.meta?.healthScore;
  const healthRisk = item.meta?.healthRisk ?? (typeof healthScore === 'number' && healthScore < 50 ? 'high' : healthScore < 75 ? 'moderate' : 'low');
  const healthRiskColor = healthRisk === 'high' ? '#EF4444' : healthRisk === 'moderate' ? '#F59E0B' : '#22C55E';
  const healthBg = `${healthRiskColor}22`;
  const showDate = item.meta?.showDate;
  const daysOut = showDate != null ? getDaysOut(showDate) : null;
  const count = item.meta?.count;
  const phase = item.meta?.phase ?? item.meta?.clientPhase ?? null;
  const phaseLabel = phase === 'peak_week' ? 'Peak' : phase === 'prep' ? 'Prep' : phase === 'cut' ? 'Cut' : phase === 'bulk' ? 'Bulk' : phase === 'maintenance' ? 'Maint' : null;

  const handleCta = useCallback(async () => {
    await impactLight();
    onReview?.(item);
  }, [item, onReview]);

  return (
    <Card style={{ marginBottom: spacing[12], padding: spacing[16] }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 4 }}>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: bg, color }}>
              {label}
            </span>
            {typeof healthScore === 'number' && (
              <button
                type="button"
                onClick={() => onOpenHealth?.(item.clientId)}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium border-none active:opacity-80"
                style={{ background: healthBg, color: healthRiskColor }}
              >
                Health {healthScore}
              </button>
            )}
            {phaseLabel && (
              <span className="text-[11px]" style={{ color: colors.muted }}>{phaseLabel}</span>
            )}
            {daysOut !== null && daysOut >= 0 && (
              <span className="text-[11px]" style={{ color: colors.muted }}>
                {daysOut === 0 ? 'Show day' : `${daysOut}d out`}
              </span>
            )}
            {count != null && count > 1 && (
              <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(255,255,255,0.08)', color: colors.muted }}>
                {count}
              </span>
            )}
            {item.status === 'DONE' && (
              <span className="text-xs" style={{ color: colors.success }}>Done</span>
            )}
          </div>
          <button
            type="button"
            onClick={async () => { await impactLight(); onOpenClient?.(item); }}
            className="text-left block w-full min-w-0"
          >
            <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>
              {item.clientName ?? item.title}
            </p>
          </button>
          <p className="text-[13px] truncate mt-0.5" style={{ color: colors.text }}>
            {item.why}
          </p>
          {item.subtitle && item.subtitle !== item.why && (
            <p className="text-xs mt-1" style={{ color: colors.muted }}>{item.subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCta}
          className="flex-shrink-0 flex items-center justify-center rounded-lg active:opacity-80"
          style={{ minWidth: 44, minHeight: 44, background: 'rgba(255,255,255,0.08)', color: colors.accent }}
          aria-label={item.ctaLabel}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      {item.status === 'ACTIVE' && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          <Button variant="secondary" onClick={handleCta} style={{ flex: 1, minWidth: 0 }}>
            {item.ctaLabel}
          </Button>
          {item.clientId && (
            <Button
              variant="secondary"
              onClick={async () => { await impactLight(); onOpenClient?.(item); }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <User size={16} style={{ marginRight: 6 }} /> Client
            </Button>
          )}
          {hasReviewFlow && onMarkReviewed && (
            <Button
              variant="secondary"
              onClick={async () => {
                await impactLight();
                if (item.dedupeKey) setQueueItemState(item.dedupeKey, { status: 'DONE' });
                onMarkReviewed?.(item);
              }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Check size={16} style={{ marginRight: 6 }} /> Mark done
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

const VALID_TABS = ['active', 'waiting', 'done'];
const VALID_FILTERS = ['all', 'critical', 'reviews', 'comp_prep', 'payments', 'messages', 'leads', 'retention'];

export default function ReviewCenterGlobal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const filterFromUrl = searchParams.get('filter');
  const { user, isDemoMode, coachFocus } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const filterChips = React.useMemo(
    () => FILTER_CHIPS.filter((chip) => chip.key !== 'comp_prep' || shouldShowModule(coachFocus, 'comp_prep')),
    [coachFocus]
  );
  const outletContext = useOutletContext() || {};
  const { registerRefresh } = outletContext;
  const { refresh, lastRefreshed } = useAppRefresh(() => {});

  const silentMode = getTrainerSilentMode();
  const [segment, setSegment] = useState(() => (VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'active'));
  const [filterType, setFilterType] = useState(() => {
    if (VALID_FILTERS.includes(filterFromUrl)) {
      if (silentMode && filterFromUrl === 'all') return 'critical';
      return filterFromUrl;
    }
    return silentMode ? 'critical' : 'all';
  });
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [healthSheetClientId, setHealthSheetClientId] = useState(null);
  const healthSheetResult = useHealthScore(healthSheetClientId);

  useEffect(() => {
    if (VALID_TABS.includes(tabFromUrl)) setSegment(tabFromUrl);
    if (VALID_FILTERS.includes(filterFromUrl)) setFilterType(filterFromUrl);
  }, [tabFromUrl, filterFromUrl]);

  useEffect(() => {
    if (filterType === 'comp_prep' && !shouldShowModule(coachFocus, 'comp_prep')) setFilterType('all');
  }, [coachFocus, filterType]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildTrainerQueue({ trainerId })
      .then((list) => {
        if (!cancelled) setQueue(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled) setQueue([]);
        if (import.meta.env.DEV) console.error('[ReviewCenter] buildTrainerQueue', err);
        toast.error('Review queue failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [trainerId, lastRefreshed]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') return registerRefresh(refresh);
  }, [registerRefresh, refresh]);

  const statusFilter = STATUS_MAP[segment] ?? 'ACTIVE';
  const typeSet = FILTER_TYPES[filterType];
  const now = new Date();
  const context = { now };
  const feed = (queue || []).filter((item) => {
    if (item.status !== statusFilter) return false;
    if (filterType === 'critical') {
      if (!isCriticalQueueItem(item, context)) return false;
    } else if (typeSet && !typeSet.includes(item.type)) return false;
    return true;
  });
  const isEmpty = !loading && feed.length === 0;

  const handleReview = useCallback(
    (item) => {
      if (item.route) navigate(item.route);
      else if (item.type === 'CHECKIN_REVIEW') navigate(`/review/checkin/${encodeURIComponent(item.id)}?clientId=${encodeURIComponent(item.clientId ?? '')}`);
      else if (item.type === 'POSING_REVIEW') navigate(`/comp-prep/review/${encodeURIComponent(item.id)}?clientId=${encodeURIComponent(item.clientId ?? '')}`);
      else if (item.clientId) navigate(`/clients/${item.clientId}`);
    },
    [navigate]
  );
  const handleOpenClient = useCallback(
    (item) => {
      if (item.clientId) navigate(`/clients/${item.clientId}/review-center`);
      else if (item.type === 'NEW_LEAD') navigate('/leads');
    },
    [navigate]
  );
  const handleMarkReviewed = useCallback(
    (item) => {
      if (item.dedupeKey) setQueueItemState(item.dedupeKey, { status: 'DONE' });
      refresh();
      if (item.type === 'CHECKIN_REVIEW') navigate(`/review/checkin/${encodeURIComponent(item.id)}?clientId=${encodeURIComponent(item.clientId ?? '')}`);
      else if (item.type === 'POSING_REVIEW') navigate(`/comp-prep/review/${encodeURIComponent(item.id)}?clientId=${encodeURIComponent(item.clientId ?? '')}`);
    },
    [navigate, refresh]
  );
  const handleOpenHealth = useCallback((clientId) => setHealthSheetClientId(clientId), []);

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
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
        Review Center
      </h1>
      <div className="flex items-baseline gap-2 mb-4">
        <p className="text-sm" style={{ color: colors.muted }}>
          Check-ins, posing, and comp prep in one place
        </p>
        {lastRefreshed != null && (
          <span className="text-[11px]" style={{ color: colors.muted }}>Updated {timeAgo(lastRefreshed)}</span>
        )}
      </div>

      {silentMode && filterType === 'critical' && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl py-2.5 px-3 mb-3"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
        >
          <span className="text-[13px]" style={{ color: colors.muted }}>Silent Mode is on, showing critical only</span>
          <button
            type="button"
            onClick={async () => { await impactLight(); setFilterType('all'); }}
            className="text-[13px] font-medium flex-shrink-0"
            style={{ color: colors.accent }}
          >
            Show all
          </button>
        </div>
      )}

      <SegmentedControl
        options={SEGMENTS}
        value={segment}
        onChange={async (k) => { await impactLight(); setSegment(k); }}
      />

      <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[12] }}>
        {filterChips.map(({ key, label }) => {
          const active = filterType === key;
          return (
            <button
              key={key}
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

      {loading && (
        <div className="flex items-center justify-center" style={{ marginTop: spacing[24], minHeight: 120 }}>
          <div className="w-8 h-8 border-2 border-white/20 border-t-current rounded-full animate-spin" style={{ borderTopColor: colors.accent }} />
        </div>
      )}

      {!loading && isEmpty && (
        <div style={{ marginTop: spacing[24] }}>
          <EmptyState
            icon={Check}
            title={
              segment === 'active' ? "You're clear." :
              segment === 'waiting' ? 'Nothing waiting.' :
              'No completed items yet.'
            }
            subtext={
              segment === 'active'
                ? 'Reviews, comp prep, payments, messages, and leads in one queue.'
                : segment === 'waiting'
                  ? "Snoozed or waiting items will appear here."
                  : 'Completed items will appear here.'
            }
          />
        </div>
      )}

      {!loading && !isEmpty && (
        <div style={{ marginTop: spacing[16] }}>
          {feed.map((item) => (
            <GlobalReviewCard
              key={item.dedupeKey || `${item.type}-${item.id}`}
              item={item}
              onReview={handleReview}
              onOpenClient={handleOpenClient}
              onMarkReviewed={handleMarkReviewed}
              onOpenHealth={handleOpenHealth}
            />
          ))}
        </div>
      )}

      <HealthBreakdownSheet
        open={!!healthSheetClientId}
        onOpenChange={(open) => { if (!open) setHealthSheetClientId(null); }}
        result={healthSheetResult ? { score: healthSheetResult.score, risk: healthSheetResult.risk, flags: healthSheetResult.flags, summary: healthSheetResult.summary, phase: healthSheetResult.phase } : null}
      />
    </div>
  );
}
