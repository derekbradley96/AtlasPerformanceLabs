/**
 * Contextual coach upgrade prompts: fees vs Pro, roster milestones, analytics gate, fee summary modal.
 * Inline only — no route-blocking modals except optional summary sheet.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, TrendingUp } from 'lucide-react';
import { colors, radii } from '@/ui/tokens';
import {
  basicFeesOnVolume,
  proTotalOnVolume,
  eliteTotalOnVolume,
  formatGbpWhole,
  proVersusBasicSavings,
  ELITE_MONTHLY_GBP,
} from '@/lib/coachUpgradeMomentMath';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const MILESTONE_LEVELS = [5, 10, 15];

function milestoneStorageKey(level) {
  return `atlas_upgrade_milestone_${level}`;
}

function isMilestoneDismissed(level) {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(milestoneStorageKey(level)) === '1';
  } catch {
    return false;
  }
}

function dismissMilestone(level) {
  try {
    localStorage.setItem(milestoneStorageKey(level), '1');
  } catch {
    /* ignore */
  }
}

/** Highest milestone (5 / 10 / 15) reached and not dismissed */
export function getActiveMilestone(clientCount) {
  const n = Number(clientCount) || 0;
  let active = null;
  for (const m of MILESTONE_LEVELS) {
    if (n >= m && !isMilestoneDismissed(m)) active = m;
  }
  return active;
}

const bannerStyle = {
  borderRadius: radii.card,
  border: `1px solid ${colors.border}`,
  background: colors.surface1,
};

export function CoachClientMilestoneBanner({ clientCount, planTier }) {
  const [gone, setGone] = useState(false);
  const milestone = useMemo(() => (planTier === 'basic' && !gone ? getActiveMilestone(clientCount) : null), [clientCount, planTier, gone]);

  if (!milestone) return null;

  const handleDismiss = () => {
    dismissMilestone(milestone);
    setGone(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.22 }}
        className="relative p-3.5 sm:p-4"
        style={{ ...bannerStyle, borderLeft: `3px solid ${colors.primary}` }}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-md opacity-70 hover:opacity-100"
          style={{ color: colors.muted }}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex gap-3 pr-8">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.2)' }}
          >
            <TrendingUp className="w-4 h-4" style={{ color: colors.primary }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.primary }}>
              {milestone}+ clients
            </p>
            <p className="text-sm leading-snug" style={{ color: colors.text }}>
              Most coaches upgrade at this stage to keep more revenue.
            </p>
            <Link
              to="/plan"
              className="inline-block mt-2 text-sm font-semibold"
              style={{ color: colors.primary }}
            >
              Compare plans
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * @param {object} props
 * @param {number} props.volumeLast30d - GBP paid volume (last 30d from v_coach_revenue_summary)
 */
export function CoachProFeeComparisonBanner({ volumeLast30d, planTier, onOpenSummary }) {
  const v = Math.max(0, Number(volumeLast30d) || 0);
  if (planTier !== 'basic' || v < 50) return null;

  const basicFee = basicFeesOnVolume(v);
  const proApprox = proTotalOnVolume(v);
  const savings = proVersusBasicSavings(v);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="p-3.5 sm:p-4"
      style={{ ...bannerStyle, borderColor: 'rgba(59,130,246,0.25)' }}
    >
      <div className="flex gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(59,130,246,0.15)' }}
        >
          <Sparkles className="w-4 h-4" style={{ color: colors.accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug" style={{ color: colors.text }}>
            <span className="font-semibold">Last 30 days</span>
            <span style={{ color: colors.muted }}> (~{formatGbpWhole(v)} through payments): </span>
            you paid about <strong>{formatGbpWhole(basicFee)}</strong> in platform fees on Basic. On Pro, about{' '}
            <strong>{formatGbpWhole(proApprox)}</strong> all-in
            {savings > 0 ? (
              <span style={{ color: colors.success }}>
                {' '}
                (save ~{formatGbpWhole(savings)} vs Basic fees alone).
              </span>
            ) : (
              <span style={{ color: colors.muted }}>. As volume rises, Pro usually wins on total cost.</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {typeof onOpenSummary === 'function' && (
              <button
                type="button"
                className="text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: colors.surface2, color: colors.primary }}
                onClick={onOpenSummary}
              >
                Fee summary
              </button>
            )}
            <Link to="/plan" className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: colors.primary }}>
              View Pro
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Shown on Analytics for Basic — advanced / scaling positioning */
export function CoachAnalyticsProGateCard({ planTier }) {
  if (planTier !== 'basic') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3.5 sm:p-4 mb-4"
      style={{ ...bannerStyle, background: 'rgba(59,130,246,0.06)' }}
    >
      <p className="text-sm leading-snug" style={{ color: colors.text }}>
        <span className="font-semibold">This feature is part of Pro, designed for scaling coaches.</span>{' '}
        <span style={{ color: colors.muted }}>
          You still get roster analytics on Basic—Pro adds lower commission and tools aimed at higher-volume books.
        </span>
      </p>
      <Link to="/plan" className="inline-block mt-2 text-sm font-semibold" style={{ color: colors.primary }}>
        See what’s on Pro
      </Link>
    </motion.div>
  );
}

export function CoachMonthlyFeeSummaryModal({ open, onClose, volumeLast30d, totalRevenueAllTime, planTier }) {
  const v = Math.max(0, Number(volumeLast30d) || 0);
  const total = Math.max(0, Number(totalRevenueAllTime) || 0);

  const basicFee30 = basicFeesOnVolume(v);
  const pro30 = proTotalOnVolume(v);
  const elite30 = eliteTotalOnVolume();
  const basicFeeAllTime = basicFeesOnVolume(total);
  const proAllApprox = proTotalOnVolume(total);

  const contentStyle = { background: colors.surface1, borderColor: colors.border, color: colors.text };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md border shadow-xl" style={contentStyle}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.text }}>Fee summary</DialogTitle>
        </DialogHeader>
        <p className="text-xs -mt-2" style={{ color: colors.muted }}>
          Estimates use your plan’s commission rates on payment volume (Basic 10%, Pro £59 + 3%, Elite{' '}
          {formatGbpWhole(ELITE_MONTHLY_GBP)} + 0%). Figures are illustrative; actual billing may vary.
        </p>
        <div className="space-y-3 text-sm" style={{ color: colors.muted }}>
          <div className="flex justify-between gap-2">
            <span>Revenue (last 30 days)</span>
            <span className="font-semibold tabular-nums" style={{ color: colors.text }}>
              {formatGbpWhole(v)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Platform fees (Basic rate on 30d)</span>
            <span className="font-semibold tabular-nums" style={{ color: colors.text }}>
              {formatGbpWhole(basicFee30)}
            </span>
          </div>
          <div className="h-px" style={{ background: colors.border }} />
          <div className="flex justify-between gap-2">
            <span>Same volume on Pro (est.)</span>
            <span className="font-semibold tabular-nums" style={{ color: colors.primary }}>
              {formatGbpWhole(pro30)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Same volume on Elite (est.)</span>
            <span className="font-semibold tabular-nums" style={{ color: colors.text }}>
              {formatGbpWhole(elite30)}
            </span>
          </div>
          {total > v && (
            <>
              <div className="h-px my-2" style={{ background: colors.border }} />
              <p className="text-xs font-medium" style={{ color: colors.text }}>
                All-time paid volume (reference)
              </p>
              <div className="flex justify-between gap-2 text-xs">
                <span>Total revenue</span>
                <span className="tabular-nums">{formatGbpWhole(total)}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span>Basic fees if all at 10%</span>
                <span className="tabular-nums">{formatGbpWhole(basicFeeAllTime)}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span>Pro if one month at that scale (illustrative)</span>
                <span className="tabular-nums">{formatGbpWhole(proAllApprox)}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Link
            to="/plan"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-center"
            style={{ background: colors.primary, color: '#fff' }}
          >
            {planTier === 'basic' ? 'Upgrade to Pro' : 'Manage plan'}
          </Link>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            style={{ borderColor: colors.border, color: colors.text }}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Home stack: milestone + fee row */
export function CoachUpgradeMomentsCluster({ activeClientCount, volumeLast30d, totalRevenueAllTime, planTier }) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const openSummary = useCallback(() => setSummaryOpen(true), []);

  if (planTier !== 'basic') return null;

  const vol = Math.max(0, Number(volumeLast30d) || 0);
  const showFee = vol >= 50;
  const showMilestone = getActiveMilestone(activeClientCount) != null;
  if (!showFee && !showMilestone) return null;

  return (
    <>
      <div className="flex flex-col gap-3">
        {showMilestone && <CoachClientMilestoneBanner clientCount={activeClientCount} planTier={planTier} />}
        {showFee && (
          <CoachProFeeComparisonBanner
            volumeLast30d={vol}
            planTier={planTier}
            onOpenSummary={openSummary}
          />
        )}
      </div>
      <CoachMonthlyFeeSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        volumeLast30d={vol}
        totalRevenueAllTime={totalRevenueAllTime}
        planTier={planTier}
      />
    </>
  );
}
