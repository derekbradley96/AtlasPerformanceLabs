/**
 * Reusable chat message bubble: max 76%, incoming left / outgoing right.
 * Mobile: optional swipe-to-reply. All surfaces: long-press / right-click for action menu.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { formatRelativeDate } from '@/lib/format';
import { colors } from '@/ui/tokens';
import { useLongPress } from '@/hooks/useLongPress';

const BUBBLE_OUT = colors.primary;
const BUBBLE_IN = colors.surface1;
const LONG_PRESS_MS_MOBILE = 400;
const LONG_PRESS_MS_DESKTOP = 480;
const SWIPE_REPLY_THRESHOLD = 64;
const SWIPE_MAX_PX = 56;
const SWIPE_HORIZONTAL_MIN = 22;
const SWIPE_RATIO = 2;

async function lightHaptic() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

export default function ChatBubble({
  message,
  isOutgoing,
  isNew,
  isConsecutiveFromSameSender,
  replyPreview,
  onLongPress,
  onSwipeReply,
  enableSwipeReply = true,
  isDesktopWeb = false,
  onRetry,
  canRetry,
  variant = 'default',
}) {
  const [animateIn, setAnimateIn] = useState(!!isNew);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);
  const swipeActiveRef = useRef(false);

  const openMenu = useCallback(
    (e) => {
      if (typeof onLongPress !== 'function') return;
      setShowTimestamp(true);
      setTimeout(() => setShowTimestamp(false), 2500);
      onLongPress(message, e);
    },
    [onLongPress, message],
  );

  const longPressHandlers = useLongPress({
    onLongPress: openMenu,
    durationMs: isDesktopWeb ? LONG_PRESS_MS_DESKTOP : LONG_PRESS_MS_MOBILE,
  });

  const body = message?.body ?? '';
  const createdDate = message?.created_date;
  const swipeEnabled = enableSwipeReply && !isDesktopWeb;
  const isClientThreadVariant = variant === 'client-thread';

  useEffect(() => {
    if (!isNew) return;
    const id = requestAnimationFrame(() => setAnimateIn(false));
    return () => cancelAnimationFrame(id);
  }, [isNew]);

  const clearLongPress = useCallback(() => {
    longPressHandlers.onPointerUp?.();
  }, [longPressHandlers]);

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      clearLongPress();
      openMenu(e);
    },
    [clearLongPress, openMenu],
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0 && e.button !== undefined) return;
      startRef.current = { x: e.clientX, y: e.clientY };
      swipeActiveRef.current = false;
      setSwipeX(0);
      longPressHandlers.onPointerDown?.(e);
    },
    [longPressHandlers],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!swipeEnabled) {
        const dx = Math.abs(e.clientX - startRef.current.x);
        const dy = Math.abs(e.clientY - startRef.current.y);
        if (dx > 10 || dy > 10) clearLongPress();
        return;
      }
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > SWIPE_HORIZONTAL_MIN && absDx > absDy * SWIPE_RATIO) {
        swipeActiveRef.current = true;
        clearLongPress();
        const towardReply = isOutgoing ? Math.min(0, dx) : Math.max(0, dx);
        setSwipeX(Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, towardReply)));
      } else if (absDx > 12 || absDy > 12) clearLongPress();
    },
    [clearLongPress, swipeEnabled, isOutgoing],
  );

  const handlePointerEnd = useCallback(() => {
    clearLongPress();
    if (swipeEnabled && swipeActiveRef.current && Math.abs(swipeX) >= SWIPE_REPLY_THRESHOLD && typeof onSwipeReply === 'function') {
      lightHaptic();
      onSwipeReply(message);
    }
    swipeActiveRef.current = false;
    setSwipeX(0);
  }, [swipeX, onSwipeReply, message, clearLongPress, swipeEnabled]);

  const timestampStr = createdDate ? formatRelativeDate(createdDate) : '';
  const marginBottom = isConsecutiveFromSameSender ? 2 : 10;

  return (
    <div
      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
      style={{ marginBottom }}
    >
      <div
        className={`message-bubble no-select-callout relative select-none px-[13px] py-[12px] ${animateIn ? 'animate-in' : ''}`}
        style={{
          background: isOutgoing
            ? BUBBLE_OUT
            : (isClientThreadVariant ? colors.surface2 : BUBBLE_IN),
          color: isOutgoing ? '#fff' : colors.text,
          fontSize: 15,
          lineHeight: 1.38,
          maxWidth: isClientThreadVariant ? '78%' : '72%',
          borderRadius: isOutgoing ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          boxShadow: isOutgoing ? '0 2px 6px rgba(0,0,0,0.25)' : undefined,
          border: !isOutgoing && isClientThreadVariant ? `1px solid ${colors.border}` : undefined,
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipeX ? 'transform 0.1s ease-out' : undefined,
          touchAction: 'pan-y',
          cursor: isDesktopWeb ? 'context-menu' : undefined,
        }}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {replyPreview ? (
          <div
            style={{
              marginBottom: 8,
              padding: '6px 8px',
              borderRadius: 10,
              border: `1px solid ${isOutgoing ? 'rgba(255,255,255,0.28)' : colors.border}`,
              background: isOutgoing ? 'rgba(255,255,255,0.12)' : colors.surface2,
            }}
          >
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.3, color: isOutgoing ? 'rgba(255,255,255,0.78)' : colors.muted }}>
              Replying to
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.35, color: isOutgoing ? '#fff' : colors.text }}>
              {replyPreview}
            </p>
          </div>
        ) : null}
        {message.type === 'video' && message.media_url ? (
          <video
            src={message.media_url}
            controls
            playsInline
            style={{
              width: '100%',
              maxWidth: 280,
              maxHeight: 200,
              borderRadius: 12,
              display: 'block',
              background: '#000',
            }}
          />
        ) : (
          <p className="break-words" style={{ fontSize: 15, lineHeight: 1.38 }}>
            {body}
            {message?.edited ? (
              <span className="ml-1 text-[11px] opacity-75">(edited)</span>
            ) : null}
          </p>
        )}
        {canRetry && typeof onRetry === 'function' ? (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(message);
              }}
              className="text-[11px] font-semibold px-2 py-1 rounded-md"
              style={{
                border: `1px solid ${isOutgoing ? 'rgba(255,255,255,0.28)' : colors.border}`,
                background: isOutgoing ? 'rgba(255,255,255,0.12)' : colors.surface2,
                color: isOutgoing ? '#fff' : colors.text,
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        {showTimestamp && timestampStr ? (
          <p
            className="mt-1 text-[11px]"
            style={{
              color: isOutgoing ? 'rgba(255,255,255,0.75)' : colors.muted,
            }}
          >
            {timestampStr}
          </p>
        ) : null}
      </div>
    </div>
  );
}
