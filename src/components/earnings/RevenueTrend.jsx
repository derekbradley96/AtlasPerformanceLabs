import React, { useState, useCallback, useRef } from 'react';
import { colors, spacing } from '@/ui/tokens';

const CARD_BG = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

/** SVG line chart with optional gradient and tooltip. */
export default function RevenueTrend({ series, period, style = {} }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const width = 280;
  const height = 56;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const chartData = React.useMemo(() => {
    if (!series?.length) return { points: [], pathD: '', areaD: '', n: 0 };
    const values = series.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const n = series.length;
    const stepX = (n - 1) > 0 ? chartWidth / (n - 1) : chartWidth;
    const points = series.map((d, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y, ...d };
    });
    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
    return { points, pathD, areaD, n };
  }, [series, chartWidth, chartHeight]);

  const handlePointerMove = useCallback(
    (e) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left - padding.left;
      const i = Math.round((x / chartWidth) * (chartData.n - 1));
      const idx = Math.max(0, Math.min(i, chartData.n - 1));
      const point = chartData.points[idx];
      if (point) setTooltip({ ...point, index: idx });
    },
    [chartData.points, chartData.n, chartWidth]
  );

  const handlePointerLeave = useCallback(() => setTooltip(null), []);

  if (!series?.length) {
    return (
      <div className="rounded-[20px] overflow-hidden border" style={{ background: CARD_BG, borderColor: BORDER, padding: spacing[16], ...style }}>
        <p className="text-[13px] font-semibold mb-2" style={{ color: colors.muted }}>Revenue trend</p>
        <p className="text-[13px]" style={{ color: colors.muted }}>No data for this period.</p>
      </div>
    );
  }

  const { pathD, areaD } = chartData;

  return (
    <div
      className="rounded-[20px] overflow-hidden border"
      style={{ background: CARD_BG, borderColor: BORDER, padding: spacing[16], ...style }}
    >
      <p className="text-[13px] font-semibold mb-2" style={{ color: colors.muted }}>Revenue trend</p>
      <div
        ref={containerRef}
        className="relative"
        style={{ height: 72 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={`revenueGradient-${period ?? 'default'}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={colors.accent} stopOpacity="0.15" />
              <stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#revenueGradient-${period ?? 'default'})`} />
          <path d={pathD} fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tooltip && (
          <div
            className="absolute rounded-lg px-2 py-1.5 shadow-lg pointer-events-none z-10"
            style={{
              left: Math.min(Math.max(tooltip.x - 40, 0), width - 100),
              top: 0,
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              fontSize: 12,
              color: colors.text,
            }}
          >
            <span className="font-semibold">{formatCurrency(tooltip.value)}</span>
            <span className="block text-[11px]" style={{ color: colors.muted }}>{formatDate(tooltip.date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
