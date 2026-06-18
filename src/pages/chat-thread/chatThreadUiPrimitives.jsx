import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { colors } from '@/ui/tokens';
import { safeDate } from '@/lib/format';

export const MEDIA_LONG_PRESS_MS = 420;
export const MAX_VIDEO_UPLOAD_BYTES = 40 * 1024 * 1024;
export const READ_RECEIPT_TIME_SLACK_MS = 2500;

export function isOptimisticMessageId(id) {
  const s = String(id ?? '');
  return (
    s.startsWith('local-') ||
    s.startsWith('local-img-') ||
    s.startsWith('local-video-') ||
    s.startsWith('local-gif-') ||
    s.startsWith('voice-') ||
    s.startsWith('audio-')
  );
}

export function revokeBlobUrl(url) {
  if (url && String(url).startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }
}

export function optimisticMatchesServerRow(localMsg, serverMsg) {
  if (!localMsg || !serverMsg) return false;
  if (String(localMsg.sender || '') !== String(serverMsg.sender || '')) return false;
  const lb = String(localMsg.body || '').trim();
  const sb = String(serverMsg.body || '').trim();
  if (lb.length > 0 || sb.length > 0) {
    if (lb !== sb) return false;
    const lt = safeDate(localMsg.created_date)?.getTime() ?? 0;
    const st = safeDate(serverMsg.created_date)?.getTime() ?? 0;
    return Math.abs(st - lt) < 120000;
  }
  const lu = localMsg.media_url ? String(localMsg.media_url) : '';
  const su = serverMsg.media_url ? String(serverMsg.media_url) : '';
  if (lu && su && lu === su) return true;
  const lt = localMsg.type || 'text';
  const st = serverMsg.type || 'text';
  if (lt === st && (lt === 'voice' || lt === 'image' || lt === 'gif' || lt === 'video')) {
    const ltm = safeDate(localMsg.created_date)?.getTime() ?? 0;
    const stm = safeDate(serverMsg.created_date)?.getTime() ?? 0;
    return Math.abs(stm - ltm) < 180000;
  }
  return false;
}

export function formatMessageTimestamp(iso) {
  const d = safeDate(iso);
  if (!d) return '';
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatDueDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function dateGroupLabel(iso) {
  const d = safeDate(iso);
  if (!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const other = new Date(d);
  other.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - other) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function getDaySeparatorLabel(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(d);
  msgDay.setHours(0, 0, 0, 0);
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  const diffDays = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DateSeparator({ dateStr }) {
  return (
    <div className="flex items-center justify-center" style={{ margin: '12px 0 8px' }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: colors.muted,
          background: colors.surface2,
          padding: '3px 10px',
          borderRadius: 20,
        }}
      >
        {dateStr}
      </span>
    </div>
  );
}

export async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

export async function heavyHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}

export function AttachmentActionSheet({ onPhoto, onCamera, onVideo, onCancel, bg, border }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);
  return (
    <>
      <div role="presentation" className="fixed inset-0 z-40" style={{ background: colors.overlay }} onClick={onCancel} />
      <div
        className="fixed left-4 right-4 z-50 rounded-2xl overflow-hidden border"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', background: bg, borderColor: border }}
      >
        <div className="py-1">
          <button type="button" onClick={() => { lightHaptic(); onPhoto(); onCancel(); }} className="w-full py-3 text-[15px] font-medium active:bg-white/5" style={{ color: colors.text }}>Photo</button>
          <button type="button" onClick={() => { lightHaptic(); onCamera(); onCancel(); }} className="w-full py-3 text-[15px] font-medium active:bg-white/5" style={{ color: colors.text }}>Camera</button>
          <button type="button" onClick={() => { lightHaptic(); onVideo(); onCancel(); }} className="w-full py-3 text-[15px] font-medium active:bg-white/5" style={{ color: colors.text }}>Video</button>
        </div>
      </div>
    </>
  );
}

