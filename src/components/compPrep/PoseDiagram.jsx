import React from 'react';
import { getPoseSvgUrl } from '@/lib/compPrep/poseSvgUrls';
import { colors } from '@/ui/tokens';

const ACCENT = '#3B82F6';
const ACCENT_FILL = 'rgba(37, 99, 235, 0.2)';

/**
 * Renders pose SVG (via img) + overlay SVG with tappable hotspots.
 * Coords 0–100 (percent of viewBox). Tap: highlight overlay + onHotspotTap(hotspot).
 * Bottom sheet is rendered by parent (PoseDetail).
 */
export default function PoseDiagram({ pose, activeHotspotId, onHotspotTap }) {
  const poseId = pose?.id || pose?.svgAssetPath;
  const svgUrl = getPoseSvgUrl(poseId) || getPoseSvgUrl(pose?.svgAssetPath);
  const hotspots = pose?.hotspots || [];

  if (!svgUrl) {
    return (
      <div
        className="w-full flex items-center justify-center rounded-xl bg-slate-800/50"
        style={{ aspectRatio: '1', color: colors.muted }}
      >
        <span className="text-sm">No diagram</span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-slate-800/50"
      style={{ aspectRatio: '1', maxWidth: '100%' }}
    >
      <img
        src={svgUrl}
        alt={pose?.name || 'Pose'}
        className="w-full h-full object-contain"
        style={{ color: colors.text }}
      />
      {/* SVG overlay: viewBox 0 0 100 100, same aspect ratio. Draw clickable + highlight shapes. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <g>
          {hotspots.map((h) => {
            const isActive = activeHotspotId === h.id;
            const fill = isActive ? ACCENT_FILL : 'transparent';
            const stroke = isActive ? ACCENT : 'transparent';
            const strokeWidth = isActive ? 2 : 0;
            if (h.shape === 'rect') {
              const [x, y, w, hh] = h.coords;
              return (
                <g key={h.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={hh}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    rx={2}
                  />
                </g>
              );
            }
            if (h.shape === 'circle') {
              const [cx, cy, r] = h.coords;
              return (
                <g key={h.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                </g>
              );
            }
            if (h.shape === 'poly') {
              const points = h.coords.join(' ');
              return (
                <g key={h.id}>
                  <polygon
                    points={points}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                </g>
              );
            }
            return null;
          })}
        </g>
      </svg>
      {/* Invisible hit targets (so touch works); overlay SVG has preserveAspectRatio="none" so we need a separate hit layer with same aspect ratio */}
      <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
        {hotspots.map((h) => {
          const isActive = activeHotspotId === h.id;
          if (h.shape === 'rect') {
            const [x, y, w, hh] = h.coords;
            return (
              <button
                key={h.id}
                type="button"
                className="absolute border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 rounded"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${w}%`,
                  height: `${hh}%`,
                  ...(isActive ? { boxShadow: `inset 0 0 0 2px ${ACCENT}` } : {}),
                }}
                onClick={() => onHotspotTap?.(h)}
                aria-label={h.label}
              />
            );
          }
          if (h.shape === 'circle') {
            const [cx, cy, r] = h.coords;
            return (
              <button
                key={h.id}
                type="button"
                className="absolute border-0 bg-transparent cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  left: `${cx - r}%`,
                  top: `${cy - r}%`,
                  width: `${r * 2}%`,
                  height: `${r * 2}%`,
                  ...(isActive ? { boxShadow: `inset 0 0 0 2px ${ACCENT}` } : {}),
                }}
                onClick={() => onHotspotTap?.(h)}
                aria-label={h.label}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
