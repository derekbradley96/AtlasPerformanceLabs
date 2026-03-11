/**
 * Pose comparison viewer: side-by-side or before/after slider, with zoom and grid overlay.
 * Props: leftImageUrl, rightImageUrl, leftLabel, rightLabel, onClose.
 */
import React, { useState, useCallback } from 'react';
import { colors, spacing, radii } from '@/ui/tokens';
import { ZoomIn, ZoomOut, Grid3X3, X } from 'lucide-react';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

export default function PoseComparisonViewer({
  leftImageUrl,
  rightImageUrl,
  leftLabel = 'Before',
  rightLabel = 'After',
  onClose,
}) {
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [sliderPercent, setSliderPercent] = useState(50);
  const [sliderDragging, setSliderDragging] = useState(false);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }, []);

  const handleSliderMove = useCallback(
    (e) => {
      if (!sliderDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPercent(pct);
    },
    [sliderDragging]
  );
  const handleSliderStart = useCallback(() => setSliderDragging(true), []);
  const handleSliderEnd = useCallback(() => setSliderDragging(false), []);

  React.useEffect(() => {
    if (!sliderDragging) return;
    const onMouseMove = (e) => {
      const container = document.getElementById('pose-comparison-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPercent(pct);
    };
    const onMouseUp = () => setSliderDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [sliderDragging]);

  const hasBoth = leftImageUrl && rightImageUrl;
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '100%',
    maxHeight: '100%',
    background: colors.surface1,
    borderRadius: radii.md,
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pose comparison"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: colors.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[16],
      }}
      onClick={onClose}
    >
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header: labels + controls */}
        <div
          className="flex items-center justify-between flex-wrap gap-2"
          style={{
            padding: spacing[12],
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface2,
          }}
        >
          <div className="flex items-center gap-4" style={{ color: colors.text, fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{leftLabel}</span>
            <span style={{ color: colors.muted }}>vs</span>
            <span style={{ fontWeight: 600 }}>{rightLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Zoom out"
              style={{
                padding: spacing[8],
                border: `1px solid ${colors.border}`,
                borderRadius: radii.sm,
                background: colors.surface1,
                color: colors.text,
                cursor: zoom <= ZOOM_MIN ? 'not-allowed' : 'pointer',
                opacity: zoom <= ZOOM_MIN ? 0.5 : 1,
              }}
            >
              <ZoomOut size={18} />
            </button>
            <span style={{ minWidth: 48, textAlign: 'center', fontSize: 13, color: colors.muted }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoom in"
              style={{
                padding: spacing[8],
                border: `1px solid ${colors.border}`,
                borderRadius: radii.sm,
                background: colors.surface1,
                color: colors.text,
                cursor: zoom >= ZOOM_MAX ? 'not-allowed' : 'pointer',
                opacity: zoom >= ZOOM_MAX ? 0.5 : 1,
              }}
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              aria-label={showGrid ? 'Hide grid' : 'Show grid'}
              title={showGrid ? 'Hide grid overlay' : 'Show grid overlay'}
              style={{
                padding: spacing[8],
                border: `1px solid ${showGrid ? colors.primary : colors.border}`,
                borderRadius: radii.sm,
                background: showGrid ? colors.primarySubtle : colors.surface1,
                color: showGrid ? colors.primary : colors.text,
                cursor: 'pointer',
              }}
            >
              <Grid3X3 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                padding: spacing[8],
                border: `1px solid ${colors.border}`,
                borderRadius: radii.sm,
                background: colors.surface1,
                color: colors.text,
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Comparison area: side-by-side or before/after overlay */}
        <div
          id="pose-comparison-container"
          className="relative flex-1"
          style={{
            minHeight: 280,
            maxHeight: '70vh',
            overflow: 'hidden',
          }}
          onMouseMove={hasBoth ? handleSliderMove : undefined}
          onMouseLeave={handleSliderEnd}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              minHeight: 280,
              maxHeight: '70vh',
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              position: 'relative',
            }}
          >
            {hasBoth ? (
              <>
                {/* Base: left image (before) full area */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={leftImageUrl}
                    alt={leftLabel}
                    className="max-w-full max-h-full object-contain"
                    style={{ display: 'block' }}
                    draggable={false}
                  />
                </div>
                {/* Overlay: right image (after) clipped to right of slider */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    clipPath: `inset(0 0 0 ${sliderPercent}%)`,
                    pointerEvents: 'none',
                  }}
                >
                  <img
                    src={rightImageUrl}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    style={{ display: 'block' }}
                    draggable={false}
                  />
                </div>
                {/* Slider handle */}
                <div
                  className="absolute top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center"
                  style={{
                    left: `calc(${sliderPercent}% - 8px)`,
                    zIndex: 10,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={handleSliderStart}
                >
                  <div
                    style={{
                      width: 4,
                      height: '50%',
                      background: colors.primary,
                      borderRadius: 2,
                      boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${colors.border} 1px, transparent 1px), linear-gradient(to bottom, ${colors.border} 1px, transparent 1px)`,
                      backgroundSize: '33.333% 33.333%',
                    }}
                  />
                )}
              </>
            ) : (
              <>
                {(leftImageUrl || rightImageUrl) ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img
                        src={leftImageUrl || rightImageUrl}
                        alt={leftLabel || rightLabel}
                        className="max-w-full max-h-full object-contain"
                        style={{ display: 'block' }}
                        draggable={false}
                      />
                    </div>
                    {showGrid && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage: `linear-gradient(to right, ${colors.border} 1px, transparent 1px), linear-gradient(to bottom, ${colors.border} 1px, transparent 1px)`,
                          backgroundSize: '33.333% 33.333%',
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ color: colors.muted }}>No image</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
