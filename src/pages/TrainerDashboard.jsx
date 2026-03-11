import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import {
  UserPlus,
  FileText,
  DollarSign,
  ClipboardList,
  ChevronRight,
  AlertTriangle,
  ListChecks,
  UtensilsCrossed,
  Dumbbell,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { getTrainerReviewCounts } from '@/features/reviewEngine/getTrainerReviewFeed';
import { getNextShowInfo } from '@/lib/compPrep/nextShow';
import { listCompClientsForTrainer } from '@/lib/repos/compPrepRepo';
import { wasCloseoutDoneToday } from '@/lib/closeoutStore';
import { getNextBestActions } from '@/lib/atlasEdge/nextBestActions';
import { getRetentionRadar } from '@/lib/atlasEdge/retentionRadar';
import { computeRevenueStability } from '@/lib/intelligence/revenueStability';
import { getEarningsForPeriod } from '@/lib/earningsMock';
import { impactLight } from '@/lib/haptics';
import { isCoachOnboardingSkipped } from '@/lib/data/coachProfileRepo';
import { coachFocusLabel } from '@/lib/data/coachTypeHelpers';
import { shouldShowModule } from '@/lib/coachFocus';
import { useAppRefresh } from '@/lib/useAppRefresh';
import CoachOnboardingChecklist from '@/components/CoachOnboardingChecklist';
import { getDailyBriefing } from '@/lib/briefing/briefingService';
import { getTrainerSilentMode } from '@/lib/trainerPreferencesStorage';
import Button from '@/ui/Button';
import { SkeletonCard, SkeletonRow } from '@/ui/Skeleton';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';

const STATUS_ORDER = { attention: 0, needs_review: 1, on_track: 2 };
const STATUS_COLORS = { on_track: '#22C55E', needs_review: '#EAB308', attention: '#EF4444' };
const mountTransition = { duration: 0.24, ease: 'easeOut' };
const stagger = 0.06;
const LOAD_DELAY_MIN = 500;
const LOAD_DELAY_MAX = 700;

/** Risk band to label: Stable (0–30), Watch (31–60), At Risk (61+) */
const RISK_LABEL = { green: 'Stable', amber: 'Watch', red: 'At Risk' };
const RISK_LABEL_COLOR = { green: '#22C55E', amber: '#F59E0B', red: '#EF4444' };

export default function TrainerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const { registerRefresh } = outletContext;
  const { user, coachFocus, hasCompetitionPrep } = useAuth();
  const data = useData();
  const trainerId = user?.id ?? 'local-trainer';
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [inboxItems, setInboxItems] = useState({ active: [], waiting: [], done: [] });
  const { refresh, lastRefreshed } = useAppRefresh(() => setRefreshing((r) => !r));

  useEffect(() => {
    let cancelled = false;
    data.listReviewItems().then((result) => {
      if (!cancelled) setInboxItems(result || { active: [], waiting: [], done: [] });
    });
    return () => { cancelled = true; };
  }, [data, refreshing]);

  const activeInboxItems = inboxItems?.active ?? [];
  const activeInboxItemsNoUnread = useMemo(
    () => activeInboxItems.filter((item) => item.type !== 'UNREAD_MESSAGE'),
    [activeInboxItems]
  );
  const atRiskClients = useMemo(() => allClients.filter((c) => c?.status === 'attention'), [allClients]);
  const closeoutDone = wasCloseoutDoneToday();
  const isEvening = new Date().getHours() >= 19;

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    data.listClients().then((list) => {
      if (!cancelled) setAllClients(Array.isArray(list) ? list : []);
    }).catch((err) => {
      if (!cancelled) setAllClients([]);
      if (import.meta.env.DEV) console.error('[TrainerDashboard] listClients', err);
      toast.error('Dashboard failed to load');
    });
    return () => { cancelled = true; };
  }, [data, refreshing]);

  useEffect(() => {
    const delay = LOAD_DELAY_MIN + Math.random() * (LOAD_DELAY_MAX - LOAD_DELAY_MIN);
    const id = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(id);
  }, []);
  const reviewCounts = useMemo(() => getTrainerReviewCounts(trainerId), [trainerId, refreshing]);
  const missedCheckInsCount = reviewCounts.checkinsDue;
  const paymentOverdueCount = reviewCounts.paymentsOverdue;

  const revenueStability = useMemo(() => {
    const period = getEarningsForPeriod('this_month');
    const txs = (period.transactions ?? []).map((t) => ({ status: t.status, due_date: t.date, paid_at: t.status === 'paid' ? t.date : null }));
    return computeRevenueStability(txs);
  }, []);

  const compPrepCounts = useMemo(
    () => ({
      posingReviewsPending: reviewCounts.posingReviewsPending,
      missingMandatoryPosesClients: reviewCounts.missingMandatoryPosesClients,
      peakWeekDueToday: reviewCounts.peakWeekDueToday,
    }),
    [reviewCounts]
  );

  const nextShow = useMemo(
    () => getNextShowInfo(listCompClientsForTrainer(trainerId) ?? []),
    [trainerId, refreshing]
  );

  const nextBestActions = useMemo(() => getNextBestActions(trainerId), [trainerId, refreshing]);
  const retentionRadar = useMemo(() => getRetentionRadar(trainerId), [trainerId, refreshing]);

  const silentMode = getTrainerSilentMode();
  const [briefing, setBriefing] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getDailyBriefing(trainerId, new Date(), { onlyCritical: silentMode }).then((b) => {
      if (!cancelled) setBriefing(b);
    });
    return () => { cancelled = true; };
  }, [trainerId, lastRefreshed, silentMode]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') {
      return registerRefresh(refresh);
    }
  }, [registerRefresh, refresh]);

  const handleTodayRow = useCallback((path) => {
    impactLight();
    navigate(path);
  }, [navigate]);

  const handleInboxItem = useCallback((item) => {
    impactLight();
    if (item.actionRoute) {
      navigate(item.actionRoute);
      return;
    }
    if (item.type === 'CHECKIN_REVIEW') navigate(`/clients/${item.clientId}/checkins/${item.id}`);
    else if (item.type === 'PAYMENT_OVERDUE') navigate(`/messages/${item.clientId}`, { state: { from: location.pathname } });
    else if (item.type === 'UNREAD_MESSAGE') navigate(`/messages/${item.clientId}`, { state: { from: location.pathname } });
    else if (item.type === 'NEW_LEAD') navigate('/inbox');
    else if (item.type === 'RETENTION_RISK' && item.clientId) navigate(`/clients/${item.clientId}`);
    else if (item.type === 'AT_RISK' && item.clientId) navigate(`/clients/${item.clientId}`);
    else navigate('/inbox');
  }, [navigate, location.pathname]);

  const handleOpenInbox = useCallback(async () => {
    await impactLight();
    navigate('/review-center?tab=active&filter=all');
  }, [navigate]);

  const handleClientRow = useCallback((clientId) => {
    impactLight();
    navigate(`/clients/${clientId}`);
  }, [navigate]);

  const handleCloseout = useCallback(async () => {
    await impactLight();
    navigate('/closeout');
  }, [navigate]);

  const handleQuickAction = useCallback((path) => {
    impactLight();
    navigate(path);
  }, [navigate]);

  function getInitials(name) {
    return (name || '?')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (loading) {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden" style={{ display: 'flex', flexDirection: 'column', gap: spacing[24] }}>
        <SkeletonCard />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
          <div style={{ height: 18, width: '40%', background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[16] }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
          <div style={{ height: 18, width: '30%', background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
          <div style={{ background: colors.card, borderRadius: 20, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
            {[1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showOnboardingBanner = isCoachOnboardingSkipped(trainerId);

  const showPrepFeatures = hasCompetitionPrep && shouldShowModule(coachFocus, 'comp_prep');

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden">
      <div className="app-section" style={{ gap: spacing[20] }}>
        {coachFocus && (
          <p className="text-[13px]" style={{ color: colors.muted }}>{coachFocusLabel(coachFocus)}</p>
        )}
        <CoachOnboardingChecklist />
        {showOnboardingBanner && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
            transition={mountTransition}
          >
            <button
              type="button"
              onClick={() => { impactLight(); navigate('/setup'); }}
              className="w-full text-left rounded-xl border py-3 px-4 flex items-center justify-between"
              style={{ background: 'rgba(234,179,8,0.12)', borderColor: 'rgba(234,179,8,0.4)', color: colors.text }}
            >
              <span className="text-[14px] font-medium">Complete setup to unlock your public link and services</span>
              <ChevronRight size={18} style={{ color: colors.muted }} />
            </button>
          </motion.section>
        )}
        {/* Coach Briefing – compact: Reviews, Payments overdue, Peak week due; single CTA */}
        {briefing && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
            transition={{ ...mountTransition, delay: stagger * 0 }}
          >
            <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
              <div style={{ padding: spacing[12], paddingLeft: spacing[16], paddingRight: spacing[16] }}>
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Coach Briefing</h2>
                <div className="grid gap-y-2 mb-4">
                  <div className="flex justify-between text-[14px] items-center">
                    <span style={{ color: colors.muted }}>Reviews</span>
                    <span className="font-medium tabular-nums" style={{ color: colors.text }}>
                      {showPrepFeatures
                        ? `Check-ins ${briefing.counts.reviews?.checkins ?? 0}, Posing ${briefing.counts.reviews?.posing ?? 0}`
                        : `Check-ins ${briefing.counts.reviews?.checkins ?? 0}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-[14px] items-center">
                    <span style={{ color: colors.muted }}>Payments overdue</span>
                    <span className="font-medium tabular-nums" style={{ color: briefing.counts.overduePayments > 0 ? colors.attention : colors.text }}>{briefing.counts.overduePayments}</span>
                  </div>
                  {showPrepFeatures && (
                  <div className="flex justify-between text-[14px] items-center">
                    <span style={{ color: colors.muted }}>Peak week due</span>
                    <span className="font-medium tabular-nums" style={{ color: colors.text }}>{briefing.counts.peakWeekDueToday}</span>
                  </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => { await impactLight(); navigate('/review-center?tab=active&filter=all'); }}
                  className="w-full rounded-xl py-2.5 text-[14px] font-semibold min-w-0"
                  style={{ background: colors.accent, color: '#fff' }}
                >
                  Open Review Center
                </button>
              </div>
            </div>
          </motion.section>
        )}
        {!silentMode && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
          transition={{ ...mountTransition, delay: stagger * 0.5 }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: spacing[10] }}>
            <span className="text-[13px] font-medium" style={{ color: colors.muted }}>Needs Attention</span>
            <button type="button" onClick={handleOpenInbox} className="text-[13px] font-medium" style={{ color: colors.accent, minHeight: 36 }}>Open Inbox</button>
          </div>
          <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
            {activeInboxItemsNoUnread.length === 0 ? (
              <div style={{ padding: spacing[16], paddingLeft: spacing[16], paddingRight: spacing[16] }}>
                <p className="text-[14px]" style={{ color: colors.muted }}>All clear.</p>
              </div>
            ) : (
              activeInboxItemsNoUnread.slice(0, 3).map((item, idx) => (
                <button
                  key={item.itemKey}
                  type="button"
                  onClick={() => handleInboxItem(item)}
                  className="flex items-center gap-3 w-full text-left active:opacity-90 min-w-0"
                  style={{
                    minHeight: 48,
                    padding: spacing[12],
                    paddingLeft: spacing[16],
                    paddingRight: spacing[16],
                    borderBottom: idx < Math.min(3, activeInboxItemsNoUnread.length) - 1 ? `1px solid ${colors.border}` : 'none',
                    background: 'transparent',
                    border: 'none',
                    color: colors.text,
                  }}
                >
                  <span className="text-[15px] font-medium truncate flex-1 min-w-0" style={{ color: colors.text }}>{item.title}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)', color: colors.muted }}>{item.badgeLabel}</span>
                  <ChevronRight size={20} style={{ color: colors.muted }} className="flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </motion.section>
        )}

        {/* Retention Radar (Atlas Edge) – hidden in Silent Mode */}
        {!silentMode && retentionRadar.count > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
            transition={{ ...mountTransition, delay: stagger * 0.6 }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={async () => {
                await impactLight();
                navigate('/clients?filter=attention');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  impactLight();
                  navigate('/clients?filter=attention');
                }
              }}
              className="flex items-center justify-between gap-3 w-full text-left rounded-[20px] border active:opacity-90 min-w-0 cursor-pointer"
              style={{
                background: colors.card,
                borderColor: 'rgba(239,68,68,0.25)',
                padding: spacing[12],
                paddingLeft: spacing[16],
                paddingRight: spacing[16],
                minHeight: 52,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium" style={{ color: colors.muted }}>Retention radar</p>
                  <p className="text-[15px] font-semibold truncate mt-0.5" style={{ color: colors.text }}>
                    {retentionRadar.count} high retention risk
                  </p>
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[12px] font-medium flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}
              >
                {retentionRadar.count}
              </span>
              <ChevronRight size={20} style={{ color: colors.muted }} className="flex-shrink-0" />
            </div>
          </motion.section>
        )}

        {/* 3) At Risk preview – top 3 with Stable / Watch / At Risk */}
        {(atRiskClients ?? []).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
            transition={{ ...mountTransition, delay: stagger * 1 }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: spacing[10] }}>
              <span className="text-[13px] font-medium" style={{ color: colors.muted }}>At Risk</span>
              <button type="button" onClick={() => navigate('/clients')} className="text-[13px] font-medium" style={{ color: colors.accent, minHeight: 36 }}>See all</button>
            </div>
            <div className="rounded-[20px] overflow-hidden border" style={{ background: colors.card, borderColor: colors.border }}>
              {(atRiskClients ?? []).slice(0, 3).map((item, idx) => {
                const label = RISK_LABEL[item.band] || item.band;
                const labelColor = RISK_LABEL_COLOR[item.band] || colors.muted;
                const reason = item.factors?.[0]?.label || '';
                return (
                  <button
                    key={item.clientId}
                    type="button"
                    onClick={() => handleClientRow(item.clientId)}
                    className="flex items-center gap-3 w-full text-left active:opacity-90 min-w-0"
                    style={{
                      minHeight: 52,
                      padding: spacing[12],
                      paddingLeft: spacing[16],
                      paddingRight: spacing[16],
                      borderBottom: idx < Math.min(3, (atRiskClients ?? []).length) - 1 ? `1px solid ${colors.border}` : 'none',
                      background: 'transparent',
                      border: 'none',
                      color: colors.text,
                    }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: colors.text }}>
                      {getInitials(item.client?.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{item.client?.full_name || 'Client'}</p>
                      <p className="text-[12px] truncate" style={{ color: colors.muted }}>{reason || `Risk ${item.score}`}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0" style={{ background: `${labelColor}22`, color: labelColor }}>{label}</span>
                    <ChevronRight size={18} style={{ color: colors.muted }} className="flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Revenue Stability – reduced padding/height */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
          transition={{ ...mountTransition, delay: stagger * 1.2 }}
        >
          <button
            type="button"
            onClick={() => { impactLight(); navigate('/earnings'); }}
            className="flex items-center justify-between w-full text-left rounded-[20px] border active:opacity-90 min-w-0"
            style={{ background: colors.card, borderColor: colors.border, padding: spacing[12], paddingLeft: spacing[16], paddingRight: spacing[16] }}
          >
            <div className="flex items-center gap-2">
              <DollarSign size={20} style={{ color: colors.muted }} />
              <span className="text-[14px] font-medium" style={{ color: colors.text }}>Revenue Stability</span>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-medium"
              style={{
                background: revenueStability.status === 'red' ? 'rgba(239,68,68,0.2)' : revenueStability.status === 'amber' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                color: revenueStability.status === 'red' ? '#EF4444' : revenueStability.status === 'amber' ? '#F59E0B' : '#22C55E',
              }}
            >
              {revenueStability.status === 'red' ? 'Needs attention' : revenueStability.status === 'amber' ? 'Watch' : 'On track'}
            </span>
          </button>
        </motion.section>

        {/* 4) Closeout card */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
          transition={{ ...mountTransition, delay: stagger * 1.5 }}
        >
          <div className="rounded-[20px] overflow-hidden border" style={{ background: colors.card, borderColor: colors.border, padding: spacing[16] }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: closeoutDone ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)', color: closeoutDone ? colors.success : colors.muted }}>
                  {closeoutDone ? 'Complete' : 'Incomplete'}
                </span>
                {!closeoutDone && isEvening && (
                  <span className="text-[12px]" style={{ color: colors.muted }}>Closeout incomplete.</span>
                )}
              </div>
              <Button variant="primary" onClick={handleCloseout} style={{ minHeight: 38 }}>Review now</Button>
            </div>
          </div>
        </motion.section>

        {/* Quick Actions – 2-col grid: Row1 Clients, Programs; Row2 Nutrition, Review Center; Row3 Earnings, Add Client; Row4 My Training */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
          transition={{ ...mountTransition, delay: stagger * 2 }}
          style={{ paddingBottom: 'max(' + spacing[16] + 'px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="grid grid-cols-2 min-w-0" style={{ gap: spacing[12] }}>
            {[
              { label: 'Clients', icon: ClipboardList, path: '/clients' },
              { label: 'Programs', icon: FileText, path: '/programs' },
              { label: 'Nutrition', icon: UtensilsCrossed, path: '/trainer/nutrition' },
              { label: 'Review Center', icon: ListChecks, path: '/review-center' },
              { label: 'Earnings', icon: DollarSign, path: '/earnings' },
              { label: 'Add Client', icon: UserPlus, path: '/inviteclient' },
              { label: 'My Training', icon: Dumbbell, path: '/my-training' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleQuickAction(item.path)}
                  className="flex flex-col items-center justify-center gap-2 rounded-[20px] border transition-colors active:opacity-90 min-w-0"
                  style={{ minHeight: 72, borderColor: colors.border, background: colors.card }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Icon size={20} style={{ color: colors.muted }} />
                  </div>
                  <span className="text-[13px] font-medium truncate px-1" style={{ color: colors.text }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </motion.section>
      </div>

      {lastRefreshed != null && Date.now() - lastRefreshed < 2500 && (
        <p className="text-center text-[12px] mt-3" style={{ color: colors.muted }}>Updated just now</p>
      )}
    </div>
  );
}
