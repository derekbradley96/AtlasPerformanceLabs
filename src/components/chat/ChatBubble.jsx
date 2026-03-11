/**
 * Reusable chat message bubble: max 76%, incoming left / outgoing right.
 * Timestamp below; supports grouping. Long-press opens Atlas action sheet (no iOS selection/callout).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { formatRelativeDate } from '@/lib/format';
import { colors } from '@/ui/tokens';
import { useLongPress } from '@/hooks/useLongPress';

const BUBBLE_OUT = colors.primary;
const BUBBLE_IN = colors.surface1;
const LONG_PRESS_MS = 350;
const SWIPE_REPLY_THRESHOLD = 45;
const SWIPE_MAX_PX = 70;
const SWIPE_HORIZONTAL_MIN = 10;
const SWIPE_RATIO = 1.3;

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
  onLongPress,
  onSwipeReply,
  onDelete,
  canDelete,
}) {
  const [animateIn, setAnimateIn] = useState(!!isNew);
  const startRef = useRef({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);

  const longPressHandlers = useLongPress({
    onLongPress: useCallback(() => {
      if (typeof onLongPress === 'function') onLongPress(message);
    }, [onLongPress, message]),
    durationMs: LONG_PRESS_MS,
  });

  const body = message?.body ?? '';
  const createdDate = message?.created_date;

  useEffect(() => {
    if (!isNew) return;
    const id = requestAnimationFrame(() => setAnimateIn(false));
    return () => cancelAnimationFrame(id);
  }, [isNew]);

  const clearLongPress = useCallback(() => {
    longPressHandlers.onPointerUp?.();
  }, [longPressHandlers]);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0 && e.button !== undefined) return;
      startRef.current = { x: e.clientX, y: e.clientY };
      setSwipeX(0);
      longPressHandlers.onPointerDown?.(e);
    },
    [longPressHandlers]
  );

  const handlePointerMove = useCallback(
    (e) => {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > SWIPE_HORIZONTAL_MIN && absDx > absDy * SWIPE_RATIO) {
        clearLongPress();
        setSwipeX(Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, dx)));
      } else if (absDx > 8 || absDy > 8) clearLongPress();
    },
    [clearLongPress]
  );

  const handlePointerEnd = useCallback(() => {
    clearLongPress();
    if (Math.abs(swipeX) >= SWIPE_REPLY_THRESHOLD && typeof onSwipeReply === 'function') {
      lightHaptic();
      onSwipeReply(message);
    }
    setSwipeX(0);
  }, [swipeX, onSwipeReply, message, clearLongPress]);

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
          background: isOutgoing ? BUBBLE_OUT : BUBBLE_IN,
          color: isOutgoing ? '#fff' : colors.text,
          fontSize: 15,
          lineHeight: 1.38,
          maxWidth: '72%',
          borderRadius: isOutgoing ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          boxShadow: isOutgoing ? '0 2px 6px rgba(0,0,0,0.25)' : undefined,
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipeX ? 'transform 0.1s ease-out' : undefined,
          touchAction: 'pan-y',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <p className="break-words" style={{ fontSize: 15, lineHeight: 1.38 }}>
          {body}
        </p>
        {timestampStr ? (
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
