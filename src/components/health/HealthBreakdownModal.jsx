/**
 * Health Breakdown – full-screen modal (not a bottom sheet).
 * Same content as HealthBreakdownSheet: score + pill, this week snapshot, trends, key flags.
 */
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
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
    .map((c) => ({ at: c?.submitted_at ?? c?.created_date ?? c?.created_at, value: Number(c.weight_kg) }))
    .sort((a, b) => (safeDate(a.at)?.getTime() ?? 0) - (safeDate(b.at)?.getTime() ?? 0))
    .slice(-6)
    .reverse();
}

function getTrendDirection(current, previous) {
  if (current == null || previous == null || current === previous) return 'flat';
  return current > previous ? 'up' : 'down';
}

function getMetricsOrder(coachFocus) {
  if (coachFocus === 'competition') return ['consistency', 'weight', 'adherence', 'steps', 'sleep'];
  if (coachFocus === 'transformation') return ['adherence', 'sleep', 'steps', 'weight', 'consistency'];
  return ['weight', 'steps', 'sleep', 'adherence', 'consistency'];
}

function MetricCell({ label, value, delta, trend }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.muted;
  return (
    <div style={{ padding: spacing[12], background: colors.surface2, borderRadius: radii.sm, border: `1px solid ${colors.border}` }}>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[15px] font-semibold tabular-nums" style={{ color: colors.text }}>{value}</span>
        {delta != null && delta !== '' && <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>{delta}</span>}
        <TrendIcon size={14} style={{ color: trendColor, flexShrink: 0 }} />
      </div>
    </div>
  );
}

export default function HealthBreakdownModal({
  open,
  onOpenChange,
  result,
  wins = [],
  slips = [],
  checkIns = [],
  onAdjustPlan,
  onSendSummary,
  onRequestCheckIn,
  onMessageClient,
  coachFocus = null,
}) {
  const recentWeights = useMemo(() => getRecentWeights(checkIns), [checkIns]);
  const weightCurrent = recentWeights[0]?.value;
  const weightPrevious = recentWeights[1]?.value;
  const trendDirection = useMemo(() => getTrendDirection(weightCurrent, weightPrevious), [weightCurrent, weightPrevious]);
  const deltaVsLastWeek = useMemo(() => {
    if (weightCurrent == null || weightPrevious == null) return null;
    const d = weightCurrent - weightPrevious;
    return `${d > 0 ? '+' : ''}${d.toFixed(1)} kg`;
  }, [weightCurrent, weightPrevious]);

  const submitted = Array.isArray(checkIns) ? checkIns.filter((c) => (c?.status ?? '').toLowerCase() === 'submitted') : [];
  const latestCheckIn = [...submitted].sort((a, b) => (safeDate(b?.submitted_at ?? b?.created_date)?.getTime() ?? 0) - (safeDate(a?.submitted_at ?? a?.created_date)?.getTime() ?? 0))[0];

  const weightDisplay = weightCurrent != null ? `${Number(weightCurrent).toFixed(1)} kg` : '—';
  const stepsDisplay = latestCheckIn?.steps ?? latestCheckIn?.steps_avg != null ? `${Number(latestCheckIn?.steps ?? latestCheckIn?.steps_avg).toLocaleString()}` : '—';
  const sleepDisplay = latestCheckIn?.sleep_hours ?? latestCheckIn?.sleep_avg != null ? `${Number(latestCheckIn?.sleep_hours ?? latestCheckIn?.sleep_avg).toFixed(1)}h` : '—';
  const adherencePct = latestCheckIn?.adherence_pct;
  const adherenceDisplay = adherencePct != null ? `${Math.round(Number(adherencePct))}%` : '—';
  const totalCheckIns = Array.isArray(checkIns) ? checkIns.length : 0;
  const consistencyDisplay = totalCheckIns > 0 ? `${Math.round((submitted.length / totalCheckIns) * 100)}%` : '—';

  const riskLevel = result?.riskLevel ?? 'red';
  const badgeStyle = BADGE_STYLE[riskLevel] ?? BADGE_STYLE.red;
  const statusLabel = result?.bandLabel ?? (riskLevel === 'red' ? 'At risk' : riskLevel === 'amber' ? 'Monitor' : 'On track');
  const score = result?.score ?? 0;
  const flags = result?.flags ?? [];
  const winsList = Array.isArray(wins) ? wins.slice(0, 3) : [];
  const slipsList = Array.isArray(slips) ? slips.slice(0, 3) : [];

  if (!open) return null;

  const close = () => onOpenChange?.(false);

  return (
    <FullScreenModal
      open={open}
      title="Health Breakdown"
      rightAction="close"
      onClose={close}
    >
      {/* Score + pill + vs last week */}
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
        <span className="text-4xl font-bold tabular-nums" style={{ color: colors.text }}>{score}</span>
        <span className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
          {statusLabel}
        </span>
        <span className="flex items-center gap-1 text-sm" style={{ color: colors.muted }}>
          {trendDirection === 'up' && <TrendingUp size={16} style={{ color: colors.success }} />}
          {trendDirection === 'down' && <TrendingDown size={16} style={{ color: colors.danger }} />}
          {trendDirection === 'flat' && <Minus size={16} />}
          {deltaVsLastWeek != null ? `vs last week: ${deltaVsLastWeek}` : 'vs last week: —'}
        </span>
      </div>

      {/* This week snapshot – Key signals */}
      <div style={{ marginBottom: spacing[16] }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>This week snapshot</p>
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

      {/* Trends – vs last week */}
      <div style={{ marginBottom: spacing[16] }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Trends</p>
        <div className="grid grid-cols-2 gap-2">
          {getMetricsOrder(coachFocus).map((key) => {
            if (key === 'weight') return <MetricCell key={key} label="Weight" value={weightDisplay} delta={deltaVsLastWeek} trend={trendDirection} />;
            if (key === 'steps') return <MetricCell key={key} label="Steps" value={stepsDisplay} trend="flat" />;
            if (key === 'sleep') return <MetricCell key={key} label="Sleep" value={sleepDisplay} trend="flat" />;
            if (key === 'adherence') return <MetricCell key={key} label="Adherence" value={adherenceDisplay} trend="flat" />;
            if (key === 'consistency') return <MetricCell key={key} label="Check-in consistency" value={consistencyDisplay} trend="flat" />;
            return null;
          })}
        </div>
      </div>

      {/* Key flags */}
      <div style={{ marginBottom: spacing[16] }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Key flags</p>
        <div style={{ padding: spacing[12], background: colors.surface1, borderRadius: radii.sm, border: `1px solid ${colors.border}` }}>
          {flags.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: colors.text }}>
              {flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: colors.muted }}>No risk signals detected.</p>
          )}
        </div>
      </div>

      {/* Coach actions */}
      <div className="flex flex-col gap-2">
        {typeof onAdjustPlan === 'function' && (
          <Button variant="primary" onClick={() => { onAdjustPlan(); close(); }} style={{ width: '100%', borderRadius: radii.button }}>
            Adjust plan
          </Button>
        )}
        {typeof onSendSummary === 'function' && (
          <Button variant="secondary" onClick={() => { onSendSummary(); close(); }} style={{ width: '100%', border: `1px solid ${colors.border}` }}>
            Send summary to client
          </Button>
        )}
        {typeof onRequestCheckIn === 'function' && (
          <Button variant="secondary" onClick={() => { onRequestCheckIn(); close(); }} style={{ width: '100%', border: `1px solid ${colors.border}` }}>
            Request check-in
          </Button>
        )}
        {typeof onMessageClient === 'function' && (
          <Button variant="secondary" onClick={() => { onMessageClient(); close(); }} style={{ width: '100%', border: `1px solid ${colors.border}` }}>
            Message client
          </Button>
        )}
      </div>
    </FullScreenModal>
  );
}
