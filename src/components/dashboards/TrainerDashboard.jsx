/**
 * Home overview: Coach Briefing (max 5 rows) + Open Global Review CTA + 2x2 quick actions.
 * Data from getDailyBriefing; no duplicate counts, no pull-to-refresh label.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  Bell,
  MessageSquare,
  FileText,
  DollarSign,
  Users,
  ClipboardCheck,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import AtlasLogo from '@/components/Brand/AtlasLogo';
import { getDailyBriefing } from '@/lib/briefing/briefingService';
import { colors, spacing, radii } from '@/ui/tokens';
import BackendStatusBadge from '@/components/dev/BackendStatusBadge';

const CARD = colors.card;
const TEXT = colors.text;
const MUTED = colors.muted;
const BORDER = colors.border;

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const mountTransition = { duration: 0.24, ease: 'easeOut' };
const stagger = 0.06;

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export default function TrainerDashboard({ user, refreshKey = 0 }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const trainerId = useMemo(() => user?.id ?? 'trainer-1', [user?.id]);

  const greeting = useMemo(() => getGreeting(), []);
  const firstName = user?.full_name?.split?.(' ')?.[0] || user?.name?.split?.(' ')?.[0] || 'there';

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDailyBriefing(trainerId)
      .then((b) => {
        if (!cancelled) setBriefing(b);
      })
      .catch(() => { if (!cancelled) setBriefing(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainerId, refreshKey]);

  if (!user) return null;

  const activeCount = briefing?.counts?.activeItems ?? 0;
  const counts = briefing?.counts ?? {};
  const checkins = counts.reviews?.checkins ?? 0;
  const posing = counts.reviews?.posing ?? 0;
  const reviewsTotal = checkins + posing;
  const overduePayments = counts.overduePayments ?? 0;
  const peakWeekDueToday = counts.peakWeekDueToday ?? 0;
  const newLeads = counts.newLeads ?? 0;
  const topPriority = briefing?.topPriorities?.[0] ?? null;

  const handleQuickAction = async (path) => {
    await lightHaptic();
    navigate(path);
  };

  const handleOpenGlobalReview = async () => {
    await lightHaptic();
    navigate('/review-global');
  };

  return (
    <div
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: TEXT,
        paddingTop: 'max(16px, env(safe-area-inset-top, 0))',
        paddingBottom: 24,
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0))',
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : -8 }}
        transition={mountTransition}
        className="sticky top-0 z-10 flex items-center justify-between gap-3 pb-4 mb-2 border-b"
        style={{ background: colors.bg, borderColor: BORDER }}
      >
        <div className="flex items-center gap-2 min-h-[44px] min-w-0">
          <AtlasLogo variant="header" />
          {isDev && <BackendStatusBadge />}
        </div>
        <h1 className="flex-1 text-center text-base font-semibold truncate" style={{ color: TEXT }}>
          {greeting}, {firstName}
        </h1>
        <button
          type="button"
          onClick={async () => { await lightHaptic(); navigate('/settings/notifications'); }}
          className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg active:bg-white/5"
          aria-label="Notifications"
        >
          <Bell size={22} style={{ color: MUTED }} />
        </button>
      </motion.header>

      <div className="space-y-5">
        {/* Coach Briefing – 2x2 stats, top priority, Full briefing link, CTA */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
          transition={{ ...mountTransition, delay: stagger * 1 }}
          style={{
            borderRadius: radii.lg,
            background: CARD,
            padding: spacing[12],
            border: `1px solid ${BORDER}`,
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <ClipboardCheck size={14} style={{ color: colors.accent }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Coach Briefing</h2>
            </div>
            <button
              type="button"
              onClick={() => { lightHaptic(); navigate('/briefing'); }}
              className="flex items-center gap-1 text-xs font-medium rounded-md py-1.5 px-2 active:bg-white/5"
              style={{ color: colors.accent }}
            >
              Full briefing
              <ExternalLink size={12} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="animate-spin" style={{ color: MUTED }} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2" style={{ minWidth: 0 }}>
                {[
                  { value: reviewsTotal, label: 'Reviews' },
                  { value: peakWeekDueToday, label: 'Peak week due' },
                  { value: overduePayments, label: 'Payments overdue' },
                  { value: newLeads, label: 'New leads' },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center rounded-md overflow-hidden min-w-0"
                    style={{ padding: `${spacing[8]}px ${spacing[4]}px`, background: 'rgba(255,255,255,0.04)' }}
                  >
                    <span className="text-base font-bold tabular-nums truncate w-full text-center" style={{ color: TEXT }}>
                      {value}
                    </span>
                    <span className="text-[10px] truncate w-full text-center mt-0.5" style={{ color: MUTED }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              {topPriority && (
                <div className="mb-2 rounded-md py-2 px-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: MUTED }}>Top priority</p>
                  <button
                    type="button"
                    onClick={() => { lightHaptic(); navigate(topPriority.route); }}
                    className="w-full text-left text-sm font-medium truncate block py-0.5 active:opacity-80"
                    style={{ color: TEXT }}
                  >
                    {topPriority.clientName} – {topPriority.why}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleOpenGlobalReview}
                className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm border-none"
                style={{
                  height: 48,
                  background: colors.accent,
                  color: '#fff',
                }}
              >
                Open Global Review
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </motion.section>

        {/* 2x2 Quick actions: Clients, Messages, Programs, Earnings */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 6 }}
          transition={{ ...mountTransition, delay: stagger * 2 }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: MUTED }}>Quick actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Clients', icon: Users, path: '/clients' },
              { label: 'Messages', icon: MessageSquare, path: '/messages' },
              { label: 'Programs', icon: FileText, path: '/programs' },
              { label: 'Earnings', icon: DollarSign, path: '/earnings' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleQuickAction(item.path)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border text-left min-h-[80px] p-4 active:bg-white/5 transition-colors"
                  style={{ background: CARD, borderColor: BORDER }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Icon size={20} style={{ color: MUTED }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: TEXT }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

      </div>
    </div>
  );
}
