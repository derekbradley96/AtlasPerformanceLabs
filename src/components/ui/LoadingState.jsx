import React from 'react';
import { Loader2 } from 'lucide-react';
import { colors, spacing, shell } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { SkeletonRow, SkeletonCard, SkeletonInboxCard } from '@/ui/Skeleton';

export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };
  
  return (
    <Loader2 className={`${sizes[size]} animate-spin text-atlas-accent ${className}`} />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-transparent">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 1 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-atlas-surface/80 border border-atlas-border/50 rounded-2xl p-6 animate-pulse">
          <div className="h-4 bg-atlas-border/60 rounded w-1/3 mb-3" />
          <div className="h-3 bg-atlas-border/40 rounded w-2/3 mb-2" />
          <div className="h-3 bg-atlas-border/30 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** 2x2 grid of summary-card placeholders (icon box + value + label). For Progress and Analytics. */
export function ProgressSummarySkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: shell.cardRadius,
            padding: spacing[16],
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 8, background: colors.surface2, marginBottom: spacing[8] }} />
          <div style={{ height: 18, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
          <div style={{ height: 12, width: '40%', background: colors.surface2, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

/** Single trend/chart card placeholder (title bar + chart area). */
export function TrendSectionSkeleton({ height = 180 }) {
  return (
    <div
      className="animate-pulse"
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: shell.cardRadius,
        padding: spacing[16],
      }}
    >
      <div style={{ height: 12, width: '35%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[12], textTransform: 'uppercase' }} />
      <div style={{ height, width: '100%', background: colors.surface2, borderRadius: 8 }} />
    </div>
  );
}

/** Client list: card with row-shaped skeletons (avatar + 2 lines). Used on Clients.jsx while loading. */
export function ClientListSkeleton({ count = 6 }) {
  return (
    <div className="overflow-hidden" style={{ ...standardCard }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Programs list: stacked program cards. Used on Programs.jsx while loading. */
export function ProgramsListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Messages list: inbox-style rows (avatar + lines + CTA block). Matches Messages.jsx list padding. */
export function MessagesListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-2" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonInboxCard key={i} />
      ))}
    </div>
  );
}

/** Dashboard (coach home): hero + needs attention + revenue/roster + shortcut tiles. Used on CoachHomePage while loading. */
export function DashboardSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {/* Hero: pills + CTA */}
      <div className="animate-pulse rounded-2xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[20] }}>
        <div style={{ display: 'flex', gap: spacing[8], flexWrap: 'wrap', marginBottom: spacing[16] }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 28, width: 100, background: colors.surface2, borderRadius: 9999 }} />
          ))}
        </div>
        <div style={{ height: 48, width: '100%', background: colors.surface2, borderRadius: 12 }} />
      </div>
      {/* Section label + card */}
      <div>
        <div style={{ height: 12, width: 120, background: colors.surface2, borderRadius: 4, marginBottom: spacing[8] }} />
        <div className="animate-pulse rounded-2xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16], minHeight: 120 }}>
          <div style={{ height: 40, width: '70%', background: colors.surface2, borderRadius: 6 }} />
          <div style={{ height: 40, width: '50%', background: colors.surface2, borderRadius: 6, marginTop: spacing[12] }} />
        </div>
      </div>
      {/* Revenue & Roster */}
      <div>
        <div style={{ height: 12, width: 140, background: colors.surface2, borderRadius: 4, marginBottom: spacing[8] }} />
        <div className="animate-pulse rounded-2xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[12] }}>
            <div style={{ height: 14, width: 60, background: colors.surface2, borderRadius: 4 }} />
            <div style={{ height: 24, width: 70, background: colors.surface2, borderRadius: 9999 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: spacing[12] }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <div style={{ height: 10, width: 50, background: colors.surface2, borderRadius: 4, marginBottom: 4 }} />
                <div style={{ height: 14, width: 36, background: colors.surface2, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Shortcuts */}
      <div>
        <div style={{ height: 12, width: 70, background: colors.surface2, borderRadius: 4, marginBottom: spacing[8] }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, minHeight: 88, padding: spacing[12], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.surface2 }} />
              <div style={{ height: 12, width: 60, background: colors.surface2, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact habit card skeleton: label bar + 2 stat rows + CTA bar. For HabitAdherenceCard / HabitSnapshotCard. */
export function HabitCardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: shell.cardRadius,
        padding: spacing[16],
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[12] }}>
        <div style={{ height: 12, width: 100, background: colors.surface2, borderRadius: 6 }} />
        <div style={{ height: 12, width: 80, background: colors.surface2, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[16], marginBottom: spacing[12] }}>
        <div style={{ height: 18, width: 120, background: colors.surface2, borderRadius: 6 }} />
        <div style={{ height: 18, width: 100, background: colors.surface2, borderRadius: 6 }} />
      </div>
      <div style={{ height: 40, width: '100%', background: colors.surface2, borderRadius: 8 }} />
    </div>
  );
}

/** Momentum score card skeleton: icon + title + big score + bars. For Client/Athlete Dashboard and Client Detail. */
export function MomentumCardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: shell.cardRadius,
        padding: spacing[20],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: spacing[16] }}>
        <div style={{ width: 40, height: 40, borderRadius: shell.iconContainerRadius, background: colors.surface2 }} />
        <div style={{ height: 16, width: 140, background: colors.surface2, borderRadius: 6 }} />
      </div>
      <div style={{ height: 42, width: 80, background: colors.surface2, borderRadius: 8, marginBottom: spacing[12] }} />
      <div style={{ height: 24, width: 70, background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing[12] }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: colors.surface2 }} />
            <div style={{ flex: 1, height: 8, background: colors.surface2, borderRadius: 4 }} />
            <div style={{ height: 14, width: 24, background: colors.surface2, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Needs Attention / retention alerts list skeleton: section label + 3–4 list rows. */
export function RetentionAlertsSkeleton({ rowCount = 4 }) {
  return (
    <div>
      <div style={{ height: 12, width: 120, background: colors.surface2, borderRadius: 4, marginBottom: spacing[8] }} className="animate-pulse" />
      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: shell.cardRadius,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[12],
              padding: spacing[12],
              borderBottom: i < rowCount - 1 ? `1px solid ${colors.border}` : 'none',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 14, width: '70%', background: colors.surface2, borderRadius: 6, marginBottom: 6 }} />
              <div style={{ height: 12, width: '50%', background: colors.surface2, borderRadius: 6 }} />
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: colors.surface2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Milestones card skeleton: icon + title + 3 list rows. */
export function MilestonesCardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: shell.cardRadius,
        padding: spacing[16],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: spacing[12] }}>
        <div style={{ width: 32, height: 32, borderRadius: shell.iconContainerRadius, background: colors.surface2 }} />
        <div style={{ height: 15, width: 100, background: colors.surface2, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ padding: `${spacing[10]}px 0`, borderBottom: i < 3 ? `1px solid ${colors.border}` : 'none' }}>
            <div style={{ height: 14, width: '80%', background: colors.surface2, borderRadius: 6, marginBottom: 6 }} />
            <div style={{ display: 'flex', gap: spacing[8], marginTop: 4 }}>
              <div style={{ height: 10, width: 50, background: colors.surface2, borderRadius: 4 }} />
              <div style={{ height: 10, width: 60, background: colors.surface2, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Organisation dashboard: section label + 2x4 metric grid + quick actions grid + table. */
export function OrganisationDashboardSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="animate-pulse" style={{ height: 12, width: 80, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[14] }}>
            <div style={{ height: 12, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
            <div style={{ height: 24, width: '40%', background: colors.surface2, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="animate-pulse" style={{ height: 12, width: 100, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, minHeight: 72, padding: spacing[12] }} />
        ))}
      </div>
      <div className="animate-pulse" style={{ height: 12, width: 120, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div className="animate-pulse rounded-xl overflow-hidden" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', gap: spacing[12], padding: spacing[12], borderBottom: `1px solid ${colors.border}` }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ flex: 1, height: 12, background: colors.surface2, borderRadius: 6 }} />)}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', gap: spacing[12], padding: spacing[12], borderBottom: i < 3 ? `1px solid ${colors.border}` : 'none' }}>
            {[1, 2, 3, 4, 5].map((j) => <div key={j} style={{ flex: 1, height: 14, background: colors.surface2, borderRadius: 6 }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Team management: card with list of member rows. */
export function TeamManagementSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="animate-pulse" style={{ height: 12, width: 100, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div className="animate-pulse rounded-xl overflow-hidden" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing[12], padding: spacing[16], borderBottom: i < 4 ? `1px solid ${colors.border}` : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 9999, background: colors.surface2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '50%', background: colors.surface2, borderRadius: 6, marginBottom: 6 }} />
              <div style={{ height: 12, width: '30%', background: colors.surface2, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Organisation analytics: overview grid + retention card + table. */
export function OrganisationAnalyticsSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="animate-pulse" style={{ height: 12, width: 80, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[14] }}>
            <div style={{ height: 12, width: '70%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
            <div style={{ height: 22, width: '50%', background: colors.surface2, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16], minHeight: 80 }} />
      <div className="animate-pulse rounded-xl overflow-hidden" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', gap: spacing[12], padding: spacing[12], borderBottom: `1px solid ${colors.border}` }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ flex: 1, height: 12, background: colors.surface2, borderRadius: 6 }} />)}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', gap: spacing[12], padding: spacing[12], borderBottom: i < 3 ? `1px solid ${colors.border}` : 'none' }}>
            {[1, 2, 3, 4, 5].map((j) => <div key={j} style={{ flex: 1, height: 14, background: colors.surface2, borderRadius: 6 }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Client assignment card: label + small card (2 lines + select + button). */
export function ClientAssignmentSkeleton() {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="animate-pulse" style={{ height: 12, width: 120, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}>
        <div style={{ height: 14, width: '40%', background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: 12 }} />
        <div style={{ height: 36, width: '100%', background: colors.surface2, borderRadius: 8, marginBottom: 12 }} />
        <div style={{ height: 36, width: 100, background: colors.surface2, borderRadius: 8 }} />
      </div>
    </div>
  );
}

/** Revenue trend chart skeleton: label + bar area. */
export function RevenueChartSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: shell.cardRadius ?? 12,
        padding: spacing[16],
      }}
    >
      <div style={{ height: 14, width: 100, background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing[12], height: 120 }}>
        {[40, 70, 100].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: colors.surface2, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  );
}

/** Four revenue widget cards (Coach Home). */
export function RevenueWidgetsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border p-4"
          style={{ borderColor: colors.border, background: colors.card }}
        >
          <div style={{ height: 12, width: '70%', background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 24, width: '50%', background: colors.surface2, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

/** Peak Week Dashboard: title + summary 2x2 + athlete list rows. */
export function PeakWeekDashboardSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="animate-pulse" style={{ height: 20, width: 180, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div className="animate-pulse" style={{ height: 14, width: '70%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12], marginBottom: spacing[24] }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[14] }}>
            <div style={{ height: 12, width: '80%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
            <div style={{ height: 24, width: '50%', background: colors.surface2, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="animate-pulse" style={{ height: 14, width: 80, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse" style={{ padding: spacing[16], borderBottom: i < 3 ? `1px solid ${colors.border}` : 'none', display: 'flex', alignItems: 'center', gap: spacing[12] }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: colors.surface2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: 6 }} />
              <div style={{ height: 12, width: '40%', background: colors.surface2, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Payment history table skeleton: header row + 5 data rows. */
export function PaymentTableSkeleton({ rows = 5 }) {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-xl"
      style={{ background: colors.card, border: `1px solid ${colors.border}` }}
    >
      <div style={{ display: 'flex', gap: spacing[12], padding: spacing[12], borderBottom: `1px solid ${colors.border}` }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 12, background: colors.surface2, borderRadius: 6 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: spacing[12], padding: spacing[12], borderBottom: i < rows - 1 ? `1px solid ${colors.border}` : 'none' }}>
          {[1, 2, 3, 4].map((j) => (
            <div key={j} style={{ flex: 1, height: 14, background: colors.surface2, borderRadius: 6 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Subscription card skeleton: title + 2 lines + badge. */
export function SubscriptionCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border p-4"
      style={{ borderColor: colors.border, background: colors.card }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ height: 16, width: '50%', background: colors.surface2, borderRadius: 6 }} />
        <div style={{ height: 20, width: 56, background: colors.surface2, borderRadius: 8 }} />
      </div>
      <div style={{ height: 12, width: '40%', background: colors.surface2, borderRadius: 6, marginBottom: 6 }} />
      <div style={{ height: 12, width: '60%', background: colors.surface2, borderRadius: 6 }} />
    </div>
  );
}

/** Coach discovery page: filters card + grid of coach cards. */
export function CoachDiscoverySkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="animate-pulse" style={{ height: 14, width: '80%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
      <div
        className="animate-pulse rounded-xl"
        style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16], marginBottom: spacing[16] }}
      >
        <div style={{ height: 12, width: 80, background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginBottom: spacing[12] }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 32, width: 100, background: colors.surface2, borderRadius: 9999 }} />
          ))}
        </div>
        <div style={{ height: 12, width: 100, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
        <div style={{ height: 32, width: 140, background: colors.surface2, borderRadius: 8 }} />
      </div>
      <div style={{ display: 'grid', gap: spacing[12] }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12] }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: colors.surface2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 16, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 12, width: '40%', background: colors.surface2, borderRadius: 6, marginBottom: 6 }} />
                <div style={{ height: 12, width: '80%', background: colors.surface2, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Marketplace coach profile page: hero + bio + results + CTAs. */
export function CoachMarketplaceProfileSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="animate-pulse rounded-2xl overflow-hidden" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <div style={{ height: 96, background: colors.surface2 }} />
        <div style={{ padding: spacing[16], display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: colors.surface2, marginTop: -40, marginBottom: spacing[12] }} />
          <div style={{ height: 20, width: 160, background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 14, width: 120, background: colors.surface2, borderRadius: 6 }} />
        </div>
      </div>
      <div className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}>
        <div style={{ height: 12, width: 60, background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
        <div style={{ height: 12, width: '100%', background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: '90%', background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: '70%', background: colors.surface2, borderRadius: 6 }} />
      </div>
      <div className="animate-pulse" style={{ height: 14, width: 80, background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}>
            <div style={{ height: 14, width: 100, background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
            <div style={{ height: 12, width: '80%', background: colors.surface2, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
        <div style={{ height: 48, width: '100%', background: colors.surface2, borderRadius: 12 }} />
        <div style={{ height: 48, width: '100%', background: colors.surface2, borderRadius: 12 }} />
      </div>
    </div>
  );
}

/** Coach marketplace setup page: form card (fields) + accept card + button. */
export function CoachMarketplaceSetupSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="animate-pulse" style={{ height: 14, width: '90%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} />
      <div className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ marginBottom: i < 5 ? spacing[16] : 0 }}>
            <div style={{ height: 12, width: 100, background: colors.surface2, borderRadius: 6, marginBottom: 8 }} />
            <div style={{ height: 40, width: '100%', background: colors.surface2, borderRadius: 10 }} />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[16], paddingTop: spacing[16], borderTop: `1px solid ${colors.border}` }}>
          <div style={{ height: 14, width: 120, background: colors.surface2, borderRadius: 6 }} />
          <div style={{ width: 44, height: 24, borderRadius: 12, background: colors.surface2 }} />
        </div>
      </div>
      <div className="animate-pulse rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[16] }}>
        <div style={{ height: 12, width: 140, background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
        <div style={{ height: 48, width: '100%', background: colors.surface2, borderRadius: 10 }} />
      </div>
    </div>
  );
}

/** Re-export standardised empty state (card, icon container, muted text). Accepts action (node) or actionLabel+onAction. */
export { default as EmptyState } from '@/components/ui/EmptyState';

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-3xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Oops!</h3>
      <p className="text-slate-400 text-sm max-w-sm mb-6">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-atlas-accent hover:bg-atlas-accent/90 text-white rounded-xl transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}