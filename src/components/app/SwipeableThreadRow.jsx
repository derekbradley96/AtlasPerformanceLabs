import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Row from '@/ui/Row';
import { colors } from '@/ui/tokens';

const ACTION_WIDTH = 88;
const REVEAL_THRESHOLD = 55;

const SPRING = {
  type: 'spring',
  stiffness: 370,
  damping: 32,
  mass: 1,
};

const SCALE_MIN = 0.98;
const SCALE_RANGE = 0.015; // 1.0 -> 0.985 max

const DELETE_BG = '#DC2626';
const PIN_BG = '#3B82F6';
const UNPIN_BG = '#374151';

const HAPTIC_REVEALED = { left: false, right: false };

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

function scaleForOffset(offset) {
  const t = Math.min(1, Math.abs(offset) / ACTION_WIDTH);
  return Math.max(SCALE_MIN, 1 - t * SCALE_RANGE);
}

export default function SwipeableThreadRow({
  threadId,
  isPinned,
  avatar,
  title,
  titleRight,
  subtitle,
  rightBadge,
  onPress,
  onDelete,
  onPinToggle,
  isDeleting,
  onDeleteAnimationEnd,
  activeSwipedThreadId,
  onSwipeStart,
  onSwipeEnd,
  onSwipeProgress,
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [revealed, setRevealed] = useState(HAPTIC_REVEALED);
  const startX = useRef(0);
  const offsetAtStart = useRef(0);
  const offsetRef = useRef(0);
  const containerRef = useRef(null);

  const applySnap = useCallback((value) => {
    const clamped = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, value));
    offsetRef.current = clamped;
    setOffset(clamped);
  }, []);

  // When another row becomes active, close this one (snap to 0)
  useEffect(() => {
    if (activeSwipedThreadId != null && activeSwipedThreadId !== threadId && offsetRef.current !== 0) {
      setIsDragging(false);
      applySnap(0);
    }
  }, [activeSwipedThreadId, threadId, applySnap]);

  const handlePointerDown = useCallback(
    (e) => {
      if (isDeleting) return;
      if (typeof onSwipeStart === 'function') onSwipeStart(threadId);
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      startX.current = x;
      offsetAtStart.current = offset;
      offsetRef.current = offset;
      setIsDragging(true);
      setRevealed(HAPTIC_REVEALED);
    },
    [isDeleting, offset, threadId, onSwipeStart]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (isDeleting || !isDragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? startX.current;
      const delta = x - startX.current;
      const next = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, offsetAtStart.current + delta));
      offsetRef.current = next;
      setOffset(next);
      if (typeof onSwipeProgress === 'function') onSwipeProgress(next);
      setRevealed((r) => {
        if (next <= -REVEAL_THRESHOLD && !r.right) {
          lightHaptic();
          return { ...r, right: true };
        }
        if (next >= REVEAL_THRESHOLD && !r.left) {
          lightHaptic();
          return { ...r, left: true };
        }
        return r;
      });
    },
    [isDeleting, isDragging, onSwipeProgress]
  );

  const endDrag = useCallback(
    (finalOffset) => {
      setIsDragging(false);
      if (typeof onSwipeEnd === 'function') onSwipeEnd();
      if (typeof onSwipeProgress === 'function') onSwipeProgress(0);
      if (Math.abs(finalOffset) < REVEAL_THRESHOLD) {
        applySnap(0);
      } else {
        applySnap(finalOffset > 0 ? ACTION_WIDTH : -ACTION_WIDTH);
      }
      setRevealed(HAPTIC_REVEALED);
    },
    [onSwipeEnd, onSwipeProgress, applySnap]
  );

  const handlePointerUp = useCallback(
    () => {
      if (isDeleting) return;
      endDrag(offsetRef.current);
    },
    [isDeleting, endDrag]
  );

  const handlePointerLeave = useCallback(
    () => {
      if (isDeleting || !isDragging) return;
      endDrag(offsetRef.current);
    },
    [isDeleting, isDragging, endDrag]
  );

  const handleDeleteClick = useCallback(
    (e) => {
      e.stopPropagation();
      lightHaptic();
      if (typeof onDelete === 'function') onDelete();
      setOffset(0);
      if (typeof onSwipeEnd === 'function') onSwipeEnd();
    },
    [onDelete, onSwipeEnd]
  );

  const handlePinClick = useCallback(
    (e) => {
      e.stopPropagation();
      lightHaptic();
      if (typeof onPinToggle === 'function') onPinToggle();
      setOffset(0);
      if (typeof onSwipeEnd === 'function') onSwipeEnd();
    },
    [onPinToggle, onSwipeEnd]
  );

  const handleContentClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (Math.abs(offset) >= REVEAL_THRESHOLD) return;
      if (onPress) onPress();
    },
    [offset, onPress]
  );

  const showLeftAction = offset > 0;
  const showRightAction = offset < 0;
  const scale = isDragging ? scaleForOffset(offset) : 1;

  return (
    <div
      ref={containerRef}
      role="presentation"
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: isDeleting ? 0 : 'auto',
        minHeight: isDeleting ? 0 : 68,
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting
          ? 'min-height 0.25s ease-out, height 0.25s ease-out, opacity 0.2s ease-out'
          : 'none',
        borderRadius: 0,
        isolation: 'isolate',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerLeave}
      onTransitionEnd={(e) => {
        if (isDeleting && e.propertyName === 'min-height' && typeof onDeleteAnimationEnd === 'function') {
          onDeleteAnimationEnd();
        }
      }}
    >
      {/* Action layer: behind content, clipped by container overflow. Only visible when content translates. Opacity gate so actions hidden until swipe > 8px. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          right: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: Math.min(1, Math.max(0, (Math.abs(offset) - 8) / 24)),
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: ACTION_WIDTH,
            background: isPinned ? UNPIN_BG : PIN_BG,
            color: '#fff',
            pointerEvents: showLeftAction ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={handlePinClick}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full border-0 cursor-pointer"
            style={{
              background: 'transparent',
              color: 'inherit',
              padding: 8,
              WebkitTapHighlightColor: 'transparent',
              minHeight: 44,
            }}
            aria-label={isPinned ? 'Unpin' : 'Pin'}
          >
            {Math.abs(offset) > 8 && (
              <>
                {isPinned ? <PinOff size={22} /> : <Pin size={22} />}
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                  {isPinned ? 'Unpin' : 'Pin'}
                </span>
              </>
            )}
          </button>
        </div>
        <div
          className="flex items-center justify-center"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: ACTION_WIDTH,
            background: DELETE_BG,
            color: '#fff',
            pointerEvents: showRightAction ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={handleDeleteClick}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full border-0 cursor-pointer"
            style={{
              background: 'transparent',
              color: 'inherit',
              padding: 8,
              WebkitTapHighlightColor: 'transparent',
              minHeight: 44,
            }}
            aria-label="Delete"
          >
            {Math.abs(offset) > 8 && (
              <>
                <Trash2 size={22} />
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                  Delete
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content layer: sits above actions, full width, opaque. Only this layer translates. */}
      <motion.div
        role="button"
        tabIndex={0}
        className="w-full text-left border-none block cursor-pointer"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minWidth: '100%',
          minHeight: 68,
          backgroundColor: colors.card,
          backgroundClip: 'padding-box',
          transformOrigin: 'left center',
          WebkitTapHighlightColor: 'transparent',
          pointerEvents: Math.abs(offset) >= REVEAL_THRESHOLD ? 'none' : 'auto',
          willChange: isDragging ? 'transform' : undefined,
          boxSizing: 'border-box',
        }}
        animate={{
          x: offset,
          scale,
        }}
        transition={
          isDragging
            ? { type: 'tween', duration: 0 }
            : SPRING
        }
        onClick={handleContentClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleContentClick(e);
          }
        }}
      >
        <Row
          as="div"
          avatar={avatar}
          title={
            isPinned ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Pin size={14} style={{ color: colors.muted, flexShrink: 0 }} />
                <span>{title}</span>
              </span>
            ) : (
              title
            )
          }
          titleRight={titleRight}
          subtitle={subtitle}
          rightBadge={rightBadge}
          showChevron={true}
          style={{ minHeight: 68 }}
        />
      </motion.div>
    </div>
  );
}
