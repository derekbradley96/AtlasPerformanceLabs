import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { colors, spacing, radii } from '@/ui/tokens';
import { usePresentationMode } from '@/lib/presentationMode';
import { safeDate } from '@/lib/format';

function daysBetween(aIso, bIso) {
  const a = safeDate(aIso);
  const b = safeDate(bIso);
  if (!a || !b) return null;
  return Math.max(0, Math.round(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

function weekLabel(index) {
  return `Week ${index + 1}`;
}

function formatPhotoLabel(photo, showDate, isCompetition, index) {
  if (!photo) return '—';
  const dt = safeDate(photo.date_taken);
  const dateLabel = dt
    ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unknown date';
  if (!isCompetition || !showDate) return `${weekLabel(index)} · ${dateLabel}`;
  const outDays = daysBetween(showDate, photo.date_taken);
  if (outDays == null) return `${weekLabel(index)} · ${dateLabel}`;
  return `${Math.round(outDays / 7)} weeks out · ${dateLabel}`;
}

function interpretedWeightChange({ kgDiff, weeksBetween, isCompetition }) {
  if (kgDiff == null || weeksBetween == null || weeksBetween <= 0) return 'Add weight entries on photos to track prep trend interpretation.';
  const abs = Math.abs(kgDiff);
  if (abs < 0.2) return `Weight is stable over ${weeksBetween} weeks. Small adjustments can be enough if visuals are improving.`;
  if (kgDiff < 0) {
    if (isCompetition) return `Lost ${abs.toFixed(1)}kg in ${weeksBetween} weeks — on track if conditioning and performance are both holding.`;
    return `Down ${abs.toFixed(1)}kg in ${weeksBetween} weeks — steady progress if energy and training quality stay good.`;
  }
  if (isCompetition) return `Up ${abs.toFixed(1)}kg in ${weeksBetween} weeks — review peak prep timeline and weekly targets.`;
  return `Up ${abs.toFixed(1)}kg in ${weeksBetween} weeks — useful in a build phase if performance is also improving.`;
}

export default function PhotoComparisonView({
  photos = [],
  showDate = null,
  isCompetition = false,
  canShare = false,
}) {
  const { isDesktopWeb } = usePresentationMode();
  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => new Date(a.date_taken || 0).getTime() - new Date(b.date_taken || 0).getTime()),
    [photos]
  );
  const [poseFilter, setPoseFilter] = useState('all');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [activeMobilePanel, setActiveMobilePanel] = useState('left');
  const captureRef = useRef(null);
  const swipeStartXRef = useRef(0);

  const filteredPhotos = useMemo(() => {
    if (poseFilter === 'all') return sortedPhotos;
    if (poseFilter === 'side') {
      return sortedPhotos.filter((p) => {
        const t = p?.tag || '';
        return t === 'side_left' || t === 'side_right' || t === 'side';
      });
    }
    return sortedPhotos.filter((p) => (p?.tag || '') === poseFilter);
  }, [sortedPhotos, poseFilter]);

  useEffect(() => {
    if (!filteredPhotos.length) return;
    const oldest = filteredPhotos[0];
    const latest = filteredPhotos[filteredPhotos.length - 1];
    setLeftId((prev) => (prev && filteredPhotos.some((p) => p.id === prev) ? prev : oldest.id));
    setRightId((prev) => (prev && filteredPhotos.some((p) => p.id === prev) ? prev : latest.id));
  }, [filteredPhotos]);

  const leftPhoto = useMemo(() => filteredPhotos.find((p) => p.id === leftId) || null, [filteredPhotos, leftId]);
  const rightPhoto = useMemo(() => filteredPhotos.find((p) => p.id === rightId) || null, [filteredPhotos, rightId]);
  const leftIdx = useMemo(() => sortedPhotos.findIndex((p) => p.id === leftPhoto?.id), [sortedPhotos, leftPhoto?.id]);
  const rightIdx = useMemo(() => sortedPhotos.findIndex((p) => p.id === rightPhoto?.id), [sortedPhotos, rightPhoto?.id]);

  const weightDiff = useMemo(() => {
    if (!leftPhoto?.weight_kg || !rightPhoto?.weight_kg) return null;
    return Number(rightPhoto.weight_kg) - Number(leftPhoto.weight_kg);
  }, [leftPhoto?.weight_kg, rightPhoto?.weight_kg]);

  const weeksBetween = useMemo(() => {
    if (!leftPhoto?.date_taken || !rightPhoto?.date_taken) return null;
    const d = daysBetween(leftPhoto.date_taken, rightPhoto.date_taken);
    if (d == null) return null;
    return Math.max(1, Math.round(d / 7));
  }, [leftPhoto?.date_taken, rightPhoto?.date_taken]);

  const handleShare = async () => {
    if (!captureRef.current || !canShare) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#0b1020', scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import(/* @vite-ignore */ '@capacitor/share');
        await Share.share({
          title: 'Progress comparison',
          text: 'Progress photo comparison',
          url: dataUrl,
          dialogTitle: 'Share comparison',
        });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `progress-comparison-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
      }
      toast.success('Comparison image ready');
    } catch (e) {
      toast.error('Could not export comparison image');
    }
  };

  const onTouchStart = (e) => {
    swipeStartXRef.current = e.touches?.[0]?.clientX || 0;
  };
  const onTouchEnd = (e) => {
    const endX = e.changedTouches?.[0]?.clientX || 0;
    const delta = endX - swipeStartXRef.current;
    if (Math.abs(delta) < 40) return;
    setActiveMobilePanel(delta < 0 ? 'right' : 'left');
  };

  return (
    <div style={{ display: 'grid', gap: spacing[12] }}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs" style={{ color: colors.muted }}>Pose</label>
        <select value={poseFilter} onChange={(e) => setPoseFilter(e.target.value)} className="rounded-md px-2 py-1 text-sm" style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
          <option value="all">All poses</option>
          <option value="front">Front</option>
          <option value="side">Side (left / right)</option>
          <option value="side_left">Side left</option>
          <option value="side_right">Side right</option>
          <option value="back">Back</option>
          <option value="custom">Custom</option>
        </select>
        {canShare ? (
          <button type="button" onClick={handleShare} className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium" style={{ background: colors.primary, color: '#fff', border: 'none' }}>
            {Capacitor.isNativePlatform() ? <Share2 size={14} /> : <Download size={14} />}
            Share comparison
          </button>
        ) : null}
      </div>

      {!filteredPhotos.length ? (
        <p className="text-sm" style={{ color: colors.muted }}>No photos for this pose yet.</p>
      ) : (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: isDesktopWeb ? '1fr 1fr' : '1fr' }}>
            <div>
              <label className="text-xs" style={{ color: colors.muted }}>Left photo</label>
              <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className="w-full rounded-md px-2 py-2 text-sm" style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
                {filteredPhotos.map((p, idx) => (
                  <option key={p.id} value={p.id}>{formatPhotoLabel(p, showDate, isCompetition, idx)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: colors.muted }}>Right photo</label>
              <select value={rightId} onChange={(e) => setRightId(e.target.value)} className="w-full rounded-md px-2 py-2 text-sm" style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
                {filteredPhotos.map((p, idx) => (
                  <option key={p.id} value={p.id}>{formatPhotoLabel(p, showDate, isCompetition, idx)}</option>
                ))}
              </select>
            </div>
          </div>

          <div
            ref={captureRef}
            style={{ display: 'grid', gap: spacing[10], gridTemplateColumns: isDesktopWeb ? '1fr 1fr' : '1fr' }}
            onTouchStart={!isDesktopWeb ? onTouchStart : undefined}
            onTouchEnd={!isDesktopWeb ? onTouchEnd : undefined}
          >
            {[{ photo: leftPhoto, side: 'left', idx: leftIdx }, { photo: rightPhoto, side: 'right', idx: rightIdx }].map(({ photo, side, idx }) => (
              <div key={side} style={{ borderRadius: radii.card, border: `1px solid ${activeMobilePanel === side || isDesktopWeb ? colors.primary : colors.border}`, background: colors.surface1, overflow: 'hidden' }}>
                {photo?.photo_url ? (
                  <img src={photo.photo_url} alt={`${side} comparison`} style={{ width: '100%', height: isDesktopWeb ? 460 : 360, objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: 260 }} />
                )}
                <div style={{ padding: spacing[10] }}>
                  <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: 600 }}>
                    {formatPhotoLabel(photo, showDate, isCompetition, idx)}
                  </p>
                  {photo?.tag ? (
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                      {photo.tag === 'side_left'
                        ? 'Side left'
                        : photo.tag === 'side_right'
                          ? 'Side right'
                          : `${String(photo.tag).replace(/_/g, ' ')} pose`}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {!isDesktopWeb ? (
            <p className="text-xs" style={{ color: colors.muted }}>
              Swipe horizontally on the photos to highlight left vs right.
            </p>
          ) : null}
        </>
      )}

      <div style={{ borderRadius: radii.card, border: `1px solid ${colors.border}`, background: colors.surface1, padding: spacing[12] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Weight change summary
        </p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 14, color: colors.text, fontWeight: 600 }}>
          {weightDiff == null
            ? 'Weight data missing on one or both photos.'
            : `${weightDiff < 0 ? 'Lost' : 'Gained'} ${Math.abs(weightDiff).toFixed(1)}kg${weeksBetween ? ` in ${weeksBetween} weeks` : ''}`}
        </p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
          {interpretedWeightChange({ kgDiff: weightDiff, weeksBetween, isCompetition })}
        </p>
      </div>
    </div>
  );
}
