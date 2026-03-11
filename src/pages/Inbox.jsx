import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLongPress } from '@/components/app/useLongPress';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  Award,
  ClipboardList,
  CreditCard,
  MessageSquare,
  UserPlus,
  Pin,
  PinOff,
  Check,
  Clock,
  User,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/data/useData';
import { wasCloseoutDoneToday } from '@/lib/closeoutStore';
import {
  setStatus,
  setSnoozedUntil,
  setPinned,
  setWaitingUntil,
} from '@/lib/inboxOverridesStore';
import { addTask } from '@/lib/taskStore';
import { selectionChanged, impactMedium, impactLight, notificationSuccess } from '@/lib/haptics';
import AddTaskModal from '@/components/earnings/AddTaskModal';
import SegmentedControl from '@/ui/SegmentedControl';
import InboxRowCard from '@/ui/InboxRowCard';
import EmptyState from '@/ui/EmptyState';
import { SkeletonInboxCard } from '@/ui/Skeleton';
import { colors, spacing } from '@/ui/tokens';
import { safeDate } from '@/lib/format';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { toast } from 'sonner';
import Button from '@/ui/Button';

const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';

const SEGMENTS = [
  { key: 'active', label: 'Active' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'done', label: 'Done' },
];

/** Map inbox type to risk badge: Red = urgent, Amber = warning, Blue = admin */
function badgeToneForType(type) {
  if (type === 'PAYMENT_OVERDUE' || type === 'AT_RISK') return 'urgent';
  if (type === 'CHECKIN_REVIEW' || type === 'RETENTION_RISK') return 'warning';
  if (COMP_PREP_TYPES.includes(type)) return 'warning';
  if (type === 'UNREAD_MESSAGE' || type === 'NEW_LEAD') return 'admin';
  return 'accent';
}

function snoozeUntil(option) {
  const now = new Date();
  if (option === '2h') {
    now.setHours(now.getHours() + 2);
    return now.toISOString();
  }
  if (option === 'tomorrow') {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
    return now.toISOString();
  }
  if (option === 'next_week') {
    now.setDate(now.getDate() + 7);
    now.setHours(9, 0, 0, 0);
    return now.toISOString();
  }
  return null;
}

const COMP_PREP_TYPES = ['POSING_SUBMISSION_REVIEW', 'MISSING_MANDATORY_POSES', 'PEAK_WEEK_DUE', 'SHOW_WEEK_CHECKLIST_DUE'];

const FILTER_CHIPS = [
  { key: null, label: 'All' },
  { key: 'CHECKIN_REVIEW', label: 'Reviews' },
  { key: 'PAYMENT_OVERDUE', label: 'Payments' },
  { key: 'UNREAD_MESSAGE', label: 'Messages' },
  { key: 'NEW_LEAD', label: 'Leads' },
  { key: 'AT_RISK', label: 'At Risk' },
  { key: 'COMP_PREP', label: 'Comp Prep' },
];

export default function Inbox() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const outletContext = useOutletContext() || {};
  const { registerRefresh } = outletContext;
  const typeFilter = searchParams.get('type') || null;
  const { role, user } = useAuth();
  const data = useData();
  const trainerId = user?.id ?? 'local-trainer';

  const [segment, setSegment] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [inboxData, setInboxData] = useState({ active: [], waiting: [], done: [] });
  const [actionSheetItem, setActionSheetItem] = useState(null);
  const [leadDetailItem, setLeadDetailItem] = useState(null);
  const [createTaskFromItem, setCreateTaskFromItem] = useState(null);

  const { refresh, lastRefreshed } = useAppRefresh(() => setRefreshing((r) => !r));

  useEffect(() => {
    const t = setTimeout(() => setInitialLoad(false), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof registerRefresh === 'function') {
      return registerRefresh(refresh);
    }
  }, [registerRefresh, refresh]);

  useEffect(() => {
    let cancelled = false;
    data.listReviewItems().then((result) => {
      if (!cancelled) setInboxData(result || { active: [], waiting: [], done: [] });
    }).catch(() => { if (!cancelled) setInboxData({ active: [], waiting: [], done: [] }); });
    return () => { cancelled = true; };
  }, [data, refreshing]);

  const { active, waiting, done } = inboxData;

  let list = segment === 'active' ? active : segment === 'waiting' ? waiting : done;
  const filterParam = searchParams.get('filter');
  const showCompPrepOnly = typeFilter === 'COMP_PREP' || filterParam === 'comprep';
  if (showCompPrepOnly) list = list.filter((item) => COMP_PREP_TYPES.includes(item.type));
  else if (typeFilter) list = list.filter((item) => item.type === typeFilter);
  const isEmpty = list.length === 0;

  const showCloseoutBanner = role === 'trainer' && !wasCloseoutDoneToday() && new Date().getHours() >= 19;


  const handlePrimary = useCallback(
    async (item) => {
      await impactMedium();
      if (item.type === 'CHECKIN_REVIEW' && item.clientId) {
        navigate(`/clients/${item.clientId}/review-center?filter=checkin`);
        return;
      }
      if (item.type === 'POSING_SUBMISSION_REVIEW' && item.clientId) {
        navigate(`/clients/${item.clientId}/review-center?filter=posing`);
        return;
      }
      if (item.actionRoute) {
        navigate(item.actionRoute);
        return;
      }
      if (item.type === 'PAYMENT_OVERDUE' && item.clientId) {
        impactLight();
        navigate(`/messages/${item.clientId}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } });
        return;
      }
      if (item.type === 'UNREAD_MESSAGE') {
        navigate(`/messages/${item.clientId}`);
        return;
      }
      if (item.type === 'NEW_LEAD') {
        setLeadDetailItem(item);
        return;
      }
      if (item.type === 'RETENTION_RISK' && item.clientId) {
        navigate(`/clients/${item.clientId}`);
        return;
      }
      if (item.type === 'AT_RISK' && item.clientId) {
        navigate(`/clients/${item.clientId}`);
        return;
      }
    },
    [navigate]
  );

  const handleSnooze = useCallback((itemKey, option) => {
    const until = snoozeUntil(option);
    if (until) {
      setSnoozedUntil(itemKey, until);
      toast.success(option === '2h' ? 'Snoozed 2 hours' : option === 'tomorrow' ? 'Snoozed until tomorrow' : 'Snoozed 1 week');
      setActionSheetItem(null);
      setRefreshing((r) => !r);
    }
  }, []);

  const handleMarkDone = useCallback((itemKey, item) => {
    if (item?.id) data.completeReviewItem(item.id);
    setStatus(itemKey, 'done');
    toast.success('Marked done');
    setActionSheetItem(null);
    setRefreshing((r) => !r);
  }, [isDemoMode, data]);

  const handleMoveToWaiting = useCallback((itemKey) => {
    setStatus(itemKey, 'waiting');
    toast.success('Moved to Waiting');
    setActionSheetItem(null);
    setRefreshing((r) => !r);
  }, []);

  const handlePin = useCallback((itemKey, pinned) => {
    setPinned(itemKey, pinned);
    setActionSheetItem(null);
    setRefreshing((r) => !r);
  }, []);

  const handleOpenClient = useCallback(
    (clientId) => {
      if (clientId) navigate(`/clients/${clientId}`);
      setActionSheetItem(null);
    },
    [navigate]
  );

  const handleCreateTask = useCallback((item) => {
    setActionSheetItem(null);
    setCreateTaskFromItem(item);
  }, []);

  const handleMessageClient = useCallback(
    (clientId) => {
      navigate(`/messages/${clientId}`);
    },
    [navigate]
  );

  const handleSendReminder = useCallback((item) => {
    if (item.type === 'PAYMENT_OVERDUE' && item.clientId) {
      impactLight();
      navigate(`/messages/${item.clientId}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } });
      setActionSheetItem(null);
      return;
    }
    setStatus(item.itemKey, 'waiting');
    toast.success('Moved to Waiting');
    setActionSheetItem(null);
    setRefreshing((r) => !r);
  }, [navigate]);

  const handleRequestUpdatedPoses = useCallback((item) => {
    const until = new Date();
    until.setHours(until.getHours() + 48);
    setWaitingUntil(item.itemKey, until.toISOString());
    addTask({
      title: `Request updated poses – ${item.title}`,
      priority: 'med',
      relatedClientId: item.clientId || null,
      type: item.type || null,
    });
    toast.success('Moved to Waiting 48h; task created');
    notificationSuccess();
    setActionSheetItem(null);
    setRefreshing((r) => !r);
  }, []);

  const handleTaskAdded = useCallback(
    (payload) => {
      if (createTaskFromItem) {
        addTask({
          title: payload.title,
          priority: payload.priority || 'med',
          relatedClientId: createTaskFromItem.clientId || null,
          type: createTaskFromItem.type || null,
        });
        toast.success('Task created');
        notificationSuccess();
      }
      setCreateTaskFromItem(null);
      setRefreshing((r) => !r);
    },
    [createTaskFromItem]
  );

  if (role !== 'trainer') {
    return (
      <div className="app-screen p-4" style={{ color: colors.muted }}>
        <p>Inbox is for trainers only.</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {showCloseoutBanner && (
        <CloseoutReminderBanner onComplete={() => navigate('/closeout')} />
      )}
      <SegmentedControl options={SEGMENTS} value={segment} onChange={async (k) => { await impactLight(); setSegment(k); }} />
      <div style={{ marginTop: spacing[12] }} />
      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: spacing[12] }}>
        {FILTER_CHIPS.map(({ key, label }) => {
          const active = typeFilter === key;
          return (
            <button
              key={key ?? 'all'}
              type="button"
              onClick={async () => {
                await selectionChanged();
                if (key) setSearchParams({ type: key });
                else setSearchParams({});
              }}
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
        <button
          type="button"
          onClick={async () => { await impactLight(); navigate('/review-center'); }}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium border-none"
          style={{ background: 'rgba(255,255,255,0.08)', color: colors.accent }}
        >
          Review Center
        </button>
      </div>

      {(initialLoad || refreshing) && (
        <div className="space-y-3" style={{ marginBottom: spacing[16] }}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonInboxCard key={i} />
          ))}
        </div>
      )}

      {!initialLoad && !refreshing && isEmpty && (
        <EmptyState
          icon={Check}
          title={segment === 'active' ? "You're clear." : segment === 'waiting' ? 'Waiting on clients.' : 'Handled.'}
          subtext={segment === 'active'
            ? 'No reviews, no overdue payments, no unread client messages. Keep it steady.'
            : segment === 'waiting'
              ? "You've done your part. Follow-ups will return here if needed."
              : 'Items completed in the last 7 days.'}
          actionLabel={segment !== 'active' ? 'View Active' : undefined}
          onAction={segment !== 'active' ? () => setSegment('active') : undefined}
        />
      )}

      {!initialLoad && !refreshing && !isEmpty && (
        <div className="space-y-3">
          {list.map((item) => (
            <InboxCard
              key={item.itemKey}
              item={item}
              onPrimary={handlePrimary}
              onOpenActions={(it) => { impactLight(); setActionSheetItem(it); }}
              onMarkHandled={handleMarkDone}
              onMessageClient={handleMessageClient}
              onSendReminder={handleSendReminder}
            />
          ))}
        </div>
      )}

      {actionSheetItem && (
        <ActionSheet
          item={actionSheetItem}
          onClose={() => setActionSheetItem(null)}
          onSnooze={handleSnooze}
          onMarkDone={handleMarkDone}
          onPin={handlePin}
          onOpenClient={handleOpenClient}
          onCreateTask={handleCreateTask}
          onMoveToWaiting={handleMoveToWaiting}
          onRequestUpdatedPoses={COMP_PREP_TYPES.includes(actionSheetItem?.type) ? handleRequestUpdatedPoses : undefined}
        />
      )}

      {createTaskFromItem && (
        <AddTaskModal
          onClose={() => setCreateTaskFromItem(null)}
          onAdd={handleTaskAdded}
        />
      )}

      {leadDetailItem && (
        <LeadDetailModal
          item={leadDetailItem}
          onClose={() => setLeadDetailItem(null)}
        />
      )}

      {lastRefreshed != null && Date.now() - lastRefreshed < 2500 && (
        <p className="text-center text-[12px] mt-4" style={{ color: colors.muted }}>Updated just now</p>
      )}
    </div>
  );
}

const SWIPE_ACTION_WIDTH = 56;
const SWIPE_STRIP_WIDTH = SWIPE_ACTION_WIDTH * 3;

function SwipeableInboxRow({
  children,
  onMarkHandled,
  onMessageClient,
  onSendReminder,
  hasClientId,
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
  };
  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - startX.current;
    const next = Math.min(0, Math.max(-SWIPE_STRIP_WIDTH, startOffset.current + dx));
    setOffset(next);
  };
  const handleTouchEnd = () => {
    const open = offset < -SWIPE_STRIP_WIDTH / 2;
    setOffset(open ? -SWIPE_STRIP_WIDTH : 0);
  };

  const runHapticThen = (fn) => async () => {
    await impactMedium();
    setOffset(0);
    fn?.();
  };

  return (
    <div
      className="overflow-hidden rounded-[20px]"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-stretch"
        style={{
          width: `calc(100% + ${SWIPE_STRIP_WIDTH}px)`,
          transform: `translateX(${offset}px)`,
          transition: offset === 0 || offset === -SWIPE_STRIP_WIDTH ? 'transform 0.2s ease' : 'none',
        }}
      >
        <div className="flex-shrink-0" style={{ width: '100%' }}>
          {children}
        </div>
        <div
          className="flex flex-shrink-0 items-stretch"
          style={{
            width: SWIPE_STRIP_WIDTH,
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderLeft: 'none',
            borderRadius: '0 20px 20px 0',
          }}
        >
          <SwipeActionButton
            icon={Check}
            label="Mark handled"
            onClick={runHapticThen(onMarkHandled)}
            style={{ background: 'rgba(34,197,94,0.2)', color: '#22C55E' }}
          />
          {hasClientId && (
            <SwipeActionButton
              icon={MessageSquare}
              label="Message"
              onClick={runHapticThen(onMessageClient)}
              style={{ background: 'rgba(59,130,246,0.2)', color: '#3B82F6' }}
            />
          )}
          <SwipeActionButton
            icon={Bell}
            label="Reminder"
            onClick={runHapticThen(onSendReminder)}
            style={{ background: 'rgba(234,179,8,0.2)', color: '#EAB308' }}
          />
        </div>
      </div>
    </div>
  );
}

function SwipeActionButton({ icon: Icon, label, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center flex-1 gap-0.5 active:opacity-80"
      style={{
        minWidth: SWIPE_ACTION_WIDTH,
        color: style?.color,
        background: style?.background,
        border: 'none',
        fontSize: 10,
      }}
      aria-label={label}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function InboxCard({ item, onPrimary, onOpenActions, onMarkHandled, onMessageClient, onSendReminder }) {
  const toneKey = badgeToneForType(item.type);
  const Icon =
    item.type === 'CHECKIN_REVIEW' ? ClipboardList
    : item.type === 'PAYMENT_OVERDUE' ? CreditCard
    : item.type === 'UNREAD_MESSAGE' ? MessageSquare
    : item.type === 'AT_RISK' || item.type === 'RETENTION_RISK' ? AlertTriangle
    : COMP_PREP_TYPES.includes(item.type) ? Award
    : UserPlus;
  const longPressHandlers = useLongPress({
    onLongPress: () => onOpenActions(item),
    durationMs: 500,
  });

  const card = (
    <div {...longPressHandlers}>
      <InboxRowCard
        avatar={<Icon size={22} />}
        title={item.title}
        subtitle={item.subtitle}
        why={item.why}
        badgeLabel={item.badgeLabel}
        badgeTone={toneKey}
        priorityBadge={item.priorityBadge}
        ageLabel={item.ageLabel}
        ctaLabel={item.primaryCtaLabel}
        onCta={() => onPrimary(item)}
        onCardTap={() => onPrimary(item)}
        pinned={item.pinned}
      />
    </div>
  );

  return (
    <SwipeableInboxRow
      onMarkHandled={onMarkHandled ? () => onMarkHandled(item.itemKey, item) : undefined}
      onMessageClient={onMessageClient && item.clientId ? () => onMessageClient(item.clientId) : undefined}
      onSendReminder={onSendReminder ? () => onSendReminder(item) : undefined}
      hasClientId={!!item.clientId}
    >
      {card}
    </SwipeableInboxRow>
  );
}

function ActionSheet({ item, onClose, onSnooze, onMarkDone, onPin, onOpenClient, onCreateTask, onMoveToWaiting, onRequestUpdatedPoses }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-t-2xl overflow-hidden"
        style={{ background: colors.card, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-3 border-b" style={{ borderColor: colors.border }}>
          <p className="text-sm font-medium text-center" style={{ color: colors.muted }}>Actions</p>
        </div>
        <div className="divide-y" style={{ borderColor: colors.border }}>
          {onMoveToWaiting && (
            <SnoozeRow label="Move to Waiting" onPress={() => onMoveToWaiting(item.itemKey)} />
          )}
          {onRequestUpdatedPoses && (
            <ActionRow icon={ClipboardList} label="Request updated poses" onPress={() => onRequestUpdatedPoses(item)} />
          )}
          <SnoozeRow label="Snooze 2 hours" onPress={() => onSnooze(item.itemKey, '2h')} />
          <SnoozeRow label="Snooze until tomorrow" onPress={() => onSnooze(item.itemKey, 'tomorrow')} />
          <ActionRow icon={Check} label="Mark done" onPress={() => onMarkDone(item.itemKey, item)} />
          {onCreateTask && (
            <ActionRow icon={ClipboardList} label="Create task" onPress={() => onCreateTask(item)} />
          )}
          <ActionRow icon={item.pinned ? PinOff : Pin} label={item.pinned ? 'Unpin' : 'Pin'} onPress={() => onPin(item.itemKey, !item.pinned)} />
          {item.clientId && (
            <ActionRow icon={User} label="Open client" onPress={() => onOpenClient(item.clientId)} />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-4 text-center font-semibold"
          style={{ color: colors.muted, borderTop: `1px solid ${colors.border}` }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SnoozeRow({ label, onPress }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-80"
      style={{ color: colors.text }}
    >
      <Clock size={20} style={{ color: colors.muted }} />
      <span className="text-[15px]">{label}</span>
    </button>
  );
}

function ActionRow({ icon: Icon, label, onPress }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-80"
      style={{ color: colors.text }}
    >
      <Icon size={20} style={{ color: colors.muted }} />
      <span className="text-[15px]">{label}</span>
    </button>
  );
}

function CloseoutReminderBanner({ onComplete }) {
  return (
    <div
      className="rounded-xl flex items-center justify-between gap-3 p-3 mb-4"
      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
    >
      <span className="text-sm font-medium" style={{ color: colors.text }}>Closeout incomplete.</span>
      <button
        type="button"
        onClick={onComplete}
        className="text-sm font-semibold"
        style={{ color: colors.accent }}
      >
        Review now
      </button>
    </div>
  );
}

function LeadDetailModal({ item, onClose }) {
  const raw = item?.raw ?? {};
  const isConsult = item?.subtype === 'consultation';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
        style={{ background: colors.card, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>{isConsult ? 'Consultation request' : 'Lead'}</h2>
          <button type="button" onClick={onClose} className="text-sm font-medium" style={{ color: colors.accent }}>Close</button>
        </div>
        <div style={{ padding: spacing[16] }}>
          <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{raw.userName || raw.name || '—'}</p>
          {raw.userEmail || raw.email ? <p className="text-sm mt-1" style={{ color: colors.muted }}>{raw.userEmail || raw.email}</p> : null}
          {raw.goal && <p className="text-sm mt-2" style={{ color: colors.text }}><strong>Goal:</strong> {raw.goal}</p>}
          {raw.availability && <p className="text-sm mt-1" style={{ color: colors.muted }}><strong>Availability:</strong> {raw.availability}</p>}
          {raw.notes && <p className="text-sm mt-2" style={{ color: colors.muted }}>{raw.notes}</p>}
          <p className="text-xs mt-3" style={{ color: colors.muted }}>{raw.created_date ? (safeDate(raw.created_date)?.toLocaleString?.() ?? '—') : ''}</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Close</Button>
            <Button variant="primary" onClick={() => { onClose(); window.location.href = isConsult ? '/consultations' : '/leads'; }} style={{ flex: 1 }}>
              {isConsult ? 'Open Consultations' : 'Open Leads'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
