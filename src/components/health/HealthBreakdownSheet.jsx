/**
 * Health Breakdown – decision-focused bottom sheet for Trainer Client view.
 * Summary (score, badge, trend, delta), Key signals (wins/slips), Metrics grid,
 * Mini sparkline, Risk flags, Coach actions. Scrollable; theme tokens only.
 */
import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import Button from '@/ui/Button';
import { colors, spacing, radii } from '@/ui/tokens';
import { safeDate } from '@/lib/format';

const BADGE_STYLE = {
  green: { bg: colors.successSubtle, color: colors.success },
  amber: { bg: colors.warningSubtle, color: colors.warning },
  red: { bg: 'rgba(239,68,68,0.2)', color: colors.danger },
};

function getRecentWeights(checkIns) {
  const list = Array.isArray(checkIns) ? checkIns : [];
  return list
    .filter((c) => c?.weight_kg != null && (c?.status ?? '').toLowerCase() === 'submitted')
    .map((c) => ({
      at: c?.submitted_at ?? c?.created_date ?? c?.created_at,
      value: Number(c.weight_kg),
    }))
    .sort((a, b) => {
      const ta = safeDate(a.at)?.getTime() ?? 0;
      const tb = safeDate(b.at)?.getTime() ?? 0;
      return tb - ta;
    })
    .slice(0, 6);
}

function getTrendDirection(current, previous) {
  if (current == null || previous == null || current === previous) return 'flat';
  return current > previous ? 'up' : 'down';
}

function MetricCell({ label, value, delta, trend }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.muted;
  return (
    <div style={{ padding: spacing[12], background: colors.surface2, borderRadius: radii.sm, border: `1px solid ${colors.border}` }}>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[15px] font-semibold tabular-nums" style={{ color: colors.text }}>{value}</span>
        {delta != null && delta !== '' && (
          <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>{delta}</span>
        )}
        <TrendIcon size={14} style={{ color: trendColor, flexShrink: 0 }} />
      </div>
    </div>
  );
}

function Sparkline({ data, width = 80, height = 32 }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const values = data.map((d) => (typeof d === 'number' ? d : d?.value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={colors.primary}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/** Emphasis by coaching focus: competition = precision + check-ins, transformation = adherence + lifestyle, integrated = balanced */
function getMetricsOrder(coachFocus) {
  if (coachFocus === 'competition') {
    return ['consistency', 'weight', 'adherence', 'steps', 'sleep'];
  }
  if (coachFocus === 'transformation') {
    return ['adherence', 'sleep', 'steps', 'weight', 'consistency'];
  }
  return ['weight', 'steps', 'sleep', 'adherence', 'consistency'];
}

function getEmphasisSubtitle(coachFocus) {
  if (coachFocus === 'competition') return 'Precision & check-ins';
  if (coachFocus === 'transformation') return 'Adherence & lifestyle';
  return null;
}

export default function HealthBreakdownSheet({
  open,
  onOpenChange,
  result,
  wins = [],
  slips = [],
  checkIns = [],
  onAdjustPlan,
  onSendSummary,
  onRequestCheckIn,
  coachFocus = null,
}) {
  const recentWeights = useMemo(() => getRecentWeights(checkIns), [checkIns]);
  const chartData = useMemo(() => recentWeights.slice(0, 4).map((w) => w.value).reverse(), [recentWeights]);

  const weightCurrent = recentWeights[0]?.value;
  const weightPrevious = recentWeights[1]?.value;
  const trendDirection = useMemo(
    () => getTrendDirection(weightCurrent, weightPrevious),
    [weightCurrent, weightPrevious]
  );
  const deltaVsLastWeek = useMemo(() => {
    if (weightCurrent == null || weightPrevious == null) return null;
    const d = weightCurrent - weightPrevious;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)} kg`;
  }, [weightCurrent, weightPrevious]);

  const submitted = Array.isArray(checkIns) ? checkIns.filter((c) => (c?.status ?? '').toLowerCase() === 'submitted') : [];
  const latestCheckIn = submitted.sort((a, b) => {
    const ta = safeDate(a?.submitted_at ?? a?.created_date)?.getTime() ?? 0;
    const tb = safeDate(b?.submitted_at ?? b?.created_date)?.getTime() ?? 0;
    return tb - ta;
  })[0];

  const weightDisplay = weightCurrent != null ? `${Number(weightCurrent).toFixed(1)} kg` : '—';
  const stepsAvg = latestCheckIn?.steps ?? latestCheckIn?.steps_avg ?? null;
  const stepsDisplay = stepsAvg != null ? `${Number(stepsAvg).toLocaleString()}` : '—';
  const sleepAvg = latestCheckIn?.sleep_hours ?? latestCheckIn?.sleep_avg ?? null;
  const sleepDisplay = sleepAvg != null ? `${Number(sleepAvg).toFixed(1)}h` : '—';
  const adherencePct = latestCheckIn?.adherence_pct;
  const adherenceDisplay = adherencePct != null ? `${Math.round(Number(adherencePct))}%` : '—';
  const totalCheckIns = Array.isArray(checkIns) ? checkIns.length : 0;
  const submittedCount = submitted.length;
  const consistencyDisplay = totalCheckIns > 0 ? `${Math.round((submittedCount / totalCheckIns) * 100)}%` : '—';

  const riskLevel = result?.riskLevel ?? 'red';
  const badgeStyle = BADGE_STYLE[riskLevel] ?? BADGE_STYLE.red;
  const statusLabel = result?.bandLabel ?? (riskLevel === 'red' ? 'At risk' : riskLevel === 'amber' ? 'Monitor' : 'On track');
  const score = result?.score ?? 0;
  const flags = result?.flags ?? [];

  const winsList = Array.isArray(wins) ? wins.slice(0, 3) : [];
  const slipsList = Array.isArray(slips) ? slips.slice(0, 3) : [];

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => { if (!v) onOpenChange?.(false); }}
      snapPoints={[0.5, 0.9]}
      dismissible
      shouldScaleBackground
    >
      <DrawerContent
        className="rounded-t-2xl border-t flex flex-col max-h-[90vh]"
        style={{
          background: colors.bg,
          borderColor: colors.border,
          paddingTop: 'env(safe-area-inset-top, 0)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          paddingLeft: 'env(safe-area-inset-left, 16px)',
          paddingRight: 'env(safe-area-inset-right, 16px)',
        }}
      >
        <DrawerHeader className="px-0 pb-3 pt-0 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-lg font-bold" style={{ color: colors.text }}>
              Health Breakdown
            </DrawerTitle>
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="p-2 rounded-lg active:opacity-80"
              style={{ color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto pb-8" style={{ minHeight: 0 }}>
          {/* 1) Top Summary */}
          <div
            className="flex flex-wrap items-center gap-3"
            style={{
              padding: spacing[16],
              background: colors.surface1,
              borderRadius: radii.card,
              border: `1px solid ${colors.border}`,
              marginBottom: spacing[16],
            }}
          >
            <span className="text-4xl font-bold tabular-nums" style={{ color: colors.text }}>
              {score}
            </span>
            <span
              className="rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{ background: badgeStyle.bg, color: badgeStyle.color }}
            >
              {statusLabel}
            </span>
            <span className="flex items-center gap-1 text-sm" style={{ color: colors.muted }}>
              {trendDirection === 'up' && <TrendingUp size={16} style={{ color: colors.success }} />}
              {trendDirection === 'down' && <TrendingDown size={16} style={{ color: colors.danger }} />}
              {trendDirection === 'flat' && <Minus size={16} />}
              {deltaVsLastWeek != null ? `vs last week: ${deltaVsLastWeek}` : 'vs last week: —'}
            </span>
          </div>

          {/* 2) Key Signals */}
          <div style={{ marginBottom: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Key signals</p>
            <div className="grid grid-cols-2 gap-3">
              <div style={{ padding: spacing[12], background: colors.successSubtle, borderRadius: radii.sm, border: `1px solid ${colors.success}` }}>
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: colors.success }}>Wins</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]" style={{ color: colors.text }}>
                  {winsList.length ? winsList.map((w, i) => <li key={i}>{w}</li>) : <li>—</li>}
                </ul>
              </div>
              <div style={{ padding: spacing[12], background: colors.warningSubtle, borderRadius: radii.sm, border: `1px solid ${colors.warning}` }}>
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: colors.warning }}>Slips</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]" style={{ color: colors.text }}>
                  {slipsList.length ? slipsList.map((s, i) => <li key={i}>{s}</li>) : <li>—</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* 3) Metrics Grid + 4) Mini Trend Chart – order/emphasis by coachFocus */}
          <div style={{ marginBottom: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Metrics</p>
            {getEmphasisSubtitle(coachFocus) && (
              <p className="text-[11px] mb-2" style={{ color: colors.muted }}>{getEmphasisSubtitle(coachFocus)}</p>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {getMetricsOrder(coachFocus).map((key) => {
                if (key === 'weight') return <MetricCell key={key} label="Weight" value={weightDisplay} delta={deltaVsLastWeek} trend={trendDirection} />;
                if (key === 'steps') return <MetricCell key={key} label="Steps avg" value={stepsDisplay} trend="flat" />;
                if (key === 'sleep') return <MetricCell key={key} label="Sleep avg" value={sleepDisplay} trend="flat" />;
                if (key === 'adherence') return <MetricCell key={key} label="Adherence" value={adherenceDisplay} trend="flat" />;
                if (key === 'consistency') return <MetricCell key={key} label="Check-in consistency" value={consistencyDisplay} trend="flat" />;
                return null;
              })}
            </div>
            {chartData.length >= 2 && (
              <div style={{ padding: spacing[12], background: colors.surface2, borderRadius: radii.sm, border: `1px solid ${colors.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: colors.muted }}>Weight trend (last 4)</p>
                <Sparkline data={chartData} width={120} height={36} />
              </div>
            )}
          </div>

          {/* 5) Risk Flags */}
          <div style={{ marginBottom: spacing[20] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Risk flags</p>
            <div style={{ padding: spacing[12], background: colors.surface1, borderRadius: radii.sm, border: `1px solid ${colors.border}` }}>
              {flags.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: colors.text }}>
                  {flags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm" style={{ color: colors.muted }}>No risk signals detected.</p>
              )}
            </div>
          </div>

          {/* 6) Coach Actions */}
          <div className="flex flex-col gap-2">
            {typeof onAdjustPlan === 'function' && (
              <Button variant="primary" onClick={() => { onAdjustPlan(); onOpenChange?.(false); }} style={{ width: '100%', borderRadius: radii.button }}>
                Adjust plan
              </Button>
            )}
            {typeof onSendSummary === 'function' && (
              <Button variant="secondary" onClick={() => { onSendSummary(); onOpenChange?.(false); }} style={{ width: '100%', border: `1px solid ${colors.border}` }}>
                Send summary to client
              </Button>
            )}
            {typeof onRequestCheckIn === 'function' && (
              <Button variant="secondary" onClick={() => { onRequestCheckIn(); onOpenChange?.(false); }} style={{ width: '100%', border: `1px solid ${colors.border}` }}>
                Request check-in
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
