/**
 * Canvas overlay on a pose photo: drag to size a circle, pick colour, label, export PNG.
 * Annotations stored as normalized { x, y, radius, label, color } (0–1 relative to image natural size).
 */
import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { colors } from '@/ui/tokens';
import { Button } from '@/components/ui/button';

const COLOR_OPTIONS = [
  { id: 'red', hex: '#ef4444', label: 'Needs work' },
  { id: 'green', hex: '#22c55e', label: 'Good' },
  { id: 'amber', hex: '#f59e0b', label: 'Close' },
];

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

const PoseAnnotationCanvas = forwardRef(function PoseAnnotationCanvas({
  imageUrl,
  initialAnnotations = [],
  markerColor = 'red',
  onAnnotationsChange,
  onExportPng,
  height = 280,
}, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [display, setDisplay] = useState({ w: 1, h: 1 });
  const [annotations, setAnnotations] = useState(() => (Array.isArray(initialAnnotations) ? [...initialAnnotations] : []));
  const [colorId, setColorId] = useState(markerColor);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    setAnnotations(Array.isArray(initialAnnotations) ? [...initialAnnotations] : []);
  }, [imageUrl, initialAnnotations]);

  const syncDisplaySize = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setDisplay({ w: img.clientWidth || 1, h: img.clientHeight || 1 });
    const c = canvasRef.current;
    if (c) {
      c.width = img.clientWidth || 1;
      c.height = img.clientHeight || 1;
    }
  }, []);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const nw = natural.w || 1;
    const nh = natural.h || 1;
    const scaleX = c.width / nw;
    const scaleY = c.height / nh;
    for (const a of annotations) {
      const cx = (a.x ?? 0) * c.width;
      const cy = (a.y ?? 0) * c.height;
      const r = (a.radius ?? 0.05) * Math.min(c.width, c.height);
      ctx.strokeStyle = a.color || '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (draft && draft.cx != null) {
      const col = COLOR_OPTIONS.find((x) => x.id === colorId)?.hex || '#ef4444';
      ctx.strokeStyle = col;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(draft.cx, draft.cy, draft.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [annotations, draft, natural.w, natural.h, colorId]);

  useEffect(() => {
    redraw();
  }, [redraw, display.w, display.h]);

  useEffect(() => {
    const ro = new ResizeObserver(() => syncDisplaySize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [syncDisplaySize, imageUrl]);

  const toLocal = (clientX, clientY) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const r = img.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const onPointerDown = (e) => {
    if (!imageUrl) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    setDraft({ cx: x, cy: y, r: 4 });
  };

  const onPointerMove = (e) => {
    if (!draft) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const dx = x - draft.cx;
    const dy = y - draft.cy;
    const r = Math.max(4, Math.sqrt(dx * dx + dy * dy));
    setDraft({ ...draft, r });
  };

  const finishDraft = (e) => {
    if (!draft || !canvasRef.current) {
      setDraft(null);
      return;
    }
    const c = canvasRef.current;
    const nw = natural.w || 1;
    const nh = natural.h || 1;
    const nx = clamp01(draft.cx / c.width);
    const ny = clamp01(draft.cy / c.height);
    const nr = clamp01(draft.r / Math.min(c.width, c.height));
    const col = COLOR_OPTIONS.find((x) => x.id === colorId)?.hex || '#ef4444';
    // eslint-disable-next-line no-alert
    const label = window.prompt('Label this marker', '') ?? '';
    const next = [...annotations, { x: nx, y: ny, radius: nr, label: label.trim(), color: col }];
    setAnnotations(next);
    onAnnotationsChange?.(next);
    setDraft(null);
    e?.preventDefault?.();
  };

  const buildAnnotatedBlob = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !natural.w) return null;
    const canvas = document.createElement('canvas');
    canvas.width = natural.w;
    canvas.height = natural.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, natural.w, natural.h);
    for (const a of annotations) {
      const cx = (a.x ?? 0) * natural.w;
      const cy = (a.y ?? 0) * natural.h;
      const r = (a.radius ?? 0.05) * Math.min(natural.w, natural.h);
      ctx.strokeStyle = a.color || '#ef4444';
      ctx.lineWidth = Math.max(2, Math.round(natural.w / 200));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (a.label) {
        ctx.font = `${Math.round(Math.max(14, natural.w / 40))}px sans-serif`;
        ctx.fillStyle = a.color || '#ef4444';
        ctx.fillText(a.label, cx + r + 4, cy);
      }
    }
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);
    });
  }, [annotations, natural.w, natural.h]);

  useImperativeHandle(ref, () => ({
    exportPngBlob: () => buildAnnotatedBlob(),
  }), [buildAnnotatedBlob]);

  const handleExport = async () => {
    const blob = await buildAnnotatedBlob();
    if (blob) onExportPng?.(blob);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColorId(c.id)}
            className="text-xs px-2 py-1 rounded-md border"
            style={{
              borderColor: colorId === c.id ? colors.primary : colors.border,
              background: colorId === c.id ? colors.primarySubtle : 'transparent',
              color: colors.text,
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: c.hex }} />
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-xs mb-2" style={{ color: colors.muted }}>
        Drag on the photo to draw a circle, then add a label.
      </p>
      <div
        ref={wrapRef}
        className="relative rounded-lg overflow-hidden mx-auto"
        style={{ maxHeight: height, background: colors.surface2 }}
      >
        {imageUrl ? (
          <>
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Pose"
              className="block w-full h-auto max-w-full"
              style={{ maxHeight: height, objectFit: 'contain' }}
              draggable={false}
              onLoad={(ev) => {
                const el = ev.currentTarget;
                setNatural({ w: el.naturalWidth || 1, h: el.naturalHeight || 1 });
                syncDisplaySize();
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute left-0 top-0 touch-none"
              style={{ width: '100%', height: '100%', pointerEvents: 'auto', cursor: 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishDraft}
              onPointerLeave={() => setDraft(null)}
            />
          </>
        ) : (
          <div className="flex items-center justify-center text-xs" style={{ height, color: colors.muted }}>
            No photo
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button type="button" size="sm" variant="outline" onClick={handleExport} disabled={!annotations.length}>
          Export PNG
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setAnnotations([]);
            onAnnotationsChange?.([]);
          }}
          disabled={!annotations.length}
        >
          Clear all
        </Button>
      </div>
      {annotations.length > 0 && (
        <ul className="mt-2 text-xs space-y-1" style={{ color: colors.muted }}>
          {annotations.map((a, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span style={{ color: a.color }}>{a.label || '(no label)'}</span>
              <button
                type="button"
                className="underline"
                style={{ color: colors.text }}
                onClick={() => {
                  const next = annotations.filter((_, j) => j !== i);
                  setAnnotations(next);
                  onAnnotationsChange?.(next);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default PoseAnnotationCanvas;
