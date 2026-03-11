import React from 'react';
import { ChevronUp, ChevronDown, Minus } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

function TrendIndicator({ direction }) {
  if (direction === 'up') return <ChevronUp size={18} style={{ color: colors.success }} aria-hidden />;
  if (direction === 'down') return <ChevronDown size={18} style={{ color: colors.destructive }} aria-hidden />;
  return <Minus size={16} style={{ color: colors.muted }} aria-hidden />;
}

function MetricBlock({ label, value, delta, deltaWarning, trend }) {
  return (
    <div style={{ marginBottom: spacing[8] }}>
      <p className="text-[11px] font-medium" style={{ color: colors.muted }}>{label}</p>
      <p className="text-[15px] font-semibold flex items-center gap-1.5" style={{ color: colors.text }}>
        {trend != null && <TrendIndicator direction={trend} />}
        {value ?? '—'}
        {delta != null && delta !== 0 && (
          <span className="ml-1.5 text-xs font-normal" style={{ color: deltaWarning ? colors.warning : colors.muted }}>
            ({delta > 0 ? '+' : ''}{delta}%)
          </span>
        )}
      </p>
      {deltaWarning && (
        <p className="text-[11px] mt-0.5" style={{ color: colors.warning }}>{deltaWarning}</p>
      )}
    </div>
  );
}

/**
 * Left/right compare cards. Each panel can have metrics, notes, and optionally an image.
 * @param {{ left: import('./types').ReviewItem['left'], right?: import('./types').ReviewItem['right'] }} props
 */
export default function ReviewDiffGrid({ left, right }) {
  const renderPanel = (panel, defaultTitle) => {
    if (!panel) return null;
    const title = panel.title ?? defaultTitle;
    return (
      <Card>
        <p className="text-[12px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[12] }}>{title}</p>
        {panel.imageUri && (
          <div className="rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <img src={panel.imageUri} alt="" className="w-full aspect-square object-contain" />
          </div>
        )}
        {panel.metrics?.map((m, i) => (
          <MetricBlock
            key={i}
            label={m.label}
            value={m.value}
            delta={m.delta}
            deltaWarning={m.deltaWarning}
            trend={m.trend}
          />
        ))}
        {panel.notes != null && (
          <>
            <p className="text-[11px] font-medium mt-2" style={{ color: colors.muted }}>Notes</p>
            <p className="text-[13px] mt-0.5" style={{ color: colors.text }}>{panel.notes || '—'}</p>
          </>
        )}
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-2" style={{ gap: spacing[12], marginBottom: spacing[16] }}>
      {renderPanel(left, 'This week')}
      {renderPanel(right, 'Last week')}
    </div>
  );
}

export { TrendIndicator, MetricBlock };
