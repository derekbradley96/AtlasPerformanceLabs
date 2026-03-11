/**
 * Reusable swipe row: actions hidden behind content until user swipes.
 * Swipe RIGHT = left actions (e.g. Pin), Swipe LEFT = right actions (e.g. Delete).
 * Spring snap, scale-down during drag, blur overlay behind row.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { colors } from '@/ui/tokens';

const LEFT_WIDTH = 88;
const RIGHT_WIDTH = 88;
const LEFT_THRESHOLD = 44;
const RIGHT_THRESHOLD = 44;
const SCALE_DRAG = 0.985;
const SPRING = { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 };
const SCROLL_LOCK_THRESHOLD = 6;

async function hapticLight() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}
async function hapticMedium() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    else if (navigator.vibrate) navigator.vibrate(15);
  } catch (e) {}
}

export default function SwipeRow({
  id,
  isOpenLeft,
  isOpenRight,
  onOpenLeft,
  onOpenRight,
  onClose,
  onSwipeStart,
  onRowPress,
  leftActions,
  rightActions,
  children,
  isDeleting,
  onDeleteAnimationEnd,
}) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTranslateX = useRef(0);
  const translateXRef = useRef(0);
  const containerRef = useRef(null);
  const scrollLockRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const ignoreClickTimeoutRef = useRef(null);
  const actionsContainerRef = useRef(null);

  // Sync to parent open state (e.g. when another row opens and this one should close)
  useEffect(() => {
    if (!isOpenLeft && !isOpenRight && translateXRef.current !== 0) {
      setTranslateX(0);
      translateXRef.current = 0;
    } else if (isOpenLeft && translateXRef.current !== LEFT_WIDTH) {
      setTranslateX(LEFT_WIDTH);
      translateXRef.current = LEFT_WIDTH;
    } else if (isOpenRight && translateXRef.current !== -RIGHT_WIDTH) {
      setTranslateX(-RIGHT_WIDTH);
      translateXRef.current = -RIGHT_WIDTH;
    }
  }, [isOpenLeft, isOpenRight]);

  const applySnap = useCallback(
    (value) => {
      const clamped = Math.max(-RIGHT_WIDTH, Math.min(LEFT_WIDTH, value));
      translateXRef.current = clamped;
      setTranslateX(clamped);
    },
    []
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (isDeleting) return;
      if (onSwipeStart) onSwipeStart(id);
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      startX.current = x;
      startY.current = y;
      startTranslateX.current = translateXRef.current;
      setIsDragging(true);
    },
    [isDeleting, id, onSwipeStart]
  );

  const setIgnoreNextClick = useCallback(() => {
    if (ignoreClickTimeoutRef.current) clearTimeout(ignoreClickTimeoutRef.current);
    ignoreNextClickRef.current = true;
    ignoreClickTimeoutRef.current = setTimeout(() => {
      ignoreNextClickRef.current = false;
      ignoreClickTimeoutRef.current = null;
    }, 280);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      if (isDeleting || !isDragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? startX.current;
      const dx = x - startX.current;
      if (scrollLockRef.current === false && Math.abs(dx) > SCROLL_LOCK_THRESHOLD) {
        scrollLockRef.current = true;
        setIgnoreNextClick();
      }
      const next = Math.max(-RIGHT_WIDTH, Math.min(LEFT_WIDTH, startTranslateX.current + dx));
      translateXRef.current = next;
      setTranslateX(next);
    },
    [isDeleting, isDragging, setIgnoreNextClick]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (isDeleting || !isDragging || !e.touches?.[0]) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      if (Math.abs(dx) > SCROLL_LOCK_THRESHOLD && Math.abs(dx) >= Math.abs(dy)) {
        e.preventDefault();
      }
    },
    [isDeleting, isDragging]
  );

  const endDrag = useCallback(
    (finalX) => {
      setIsDragging(false);
      scrollLockRef.current = false;
      if (finalX > LEFT_THRESHOLD) {
        applySnap(LEFT_WIDTH);
        hapticMedium();
        setIgnoreNextClick();
        if (onOpenLeft) onOpenLeft(id);
      } else if (finalX < -RIGHT_THRESHOLD) {
        applySnap(-RIGHT_WIDTH);
        hapticMedium();
        setIgnoreNextClick();
        if (onOpenRight) onOpenRight(id);
      } else {
        applySnap(0);
        hapticLight();
        if (onClose) onClose(id);
      }
    },
    [applySnap, id, onOpenLeft, onOpenRight, onClose, setIgnoreNextClick]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (isDeleting) return;
      endDrag(translateXRef.current);
    },
    [isDeleting, endDrag]
  );

  const handlePointerLeave = useCallback(
    (e) => {
      if (isDeleting || !isDragging) return;
      endDrag(translateXRef.current);
    },
    [isDeleting, isDragging, endDrag]
  );

  const handleContentClick = useCallback(
    (e) => {
      e.stopPropagation();
      // Never treat a tap on an action button (Delete/Pin) as row press
      if (actionsContainerRef.current && actionsContainerRef.current.contains(e.target)) return;
      if (isDeleting) return;
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        if (ignoreClickTimeoutRef.current) {
          clearTimeout(ignoreClickTimeoutRef.current);
          ignoreClickTimeoutRef.current = null;
        }
        return;
      }
      const x = translateXRef.current;
      const isOpen = x > LEFT_THRESHOLD || x < -RIGHT_THRESHOLD;
      if (isOpen || isOpenLeft || isOpenRight) {
        applySnap(0);
        hapticLight();
        if (onClose) onClose(id);
        return;
      }
      if (onRowPress) {
        onRowPress();
      }
    },
    [id, isDeleting, isOpenLeft, isOpenRight, onClose, onRowPress, applySnap]
  );

  const showLeft = translateX > 0;
  const showRight = translateX < 0;
  const scale = isDragging ? SCALE_DRAG : 1;
  const blurOpacity = Math.min(1, Math.abs(translateX) / Math.max(LEFT_WIDTH, RIGHT_WIDTH)) * 0.5;
  const revealOpacity = Math.min(1, Math.max(0, (Math.abs(translateX) - 8) / 24));

  return (
    <div
      ref={containerRef}
      role="presentation"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        isolation: 'isolate',
        height: isDeleting ? 0 : 'auto',
        minHeight: isDeleting ? 0 : 68,
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting
          ? 'min-height 0.25s ease-out, height 0.25s ease-out, opacity 0.2s ease-out'
          : 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerLeave}
      onTransitionEnd={(e) => {
        if (isDeleting && e.propertyName === 'min-height' && onDeleteAnimationEnd) onDeleteAnimationEnd();
      }}
    >
      {/* Actions layer: behind content, only visible as row slides; pointerEvents auto so Delete/Pin are clickable */}
      <div
        ref={actionsContainerRef}
        data-swipe-actions
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          right: 0,
          zIndex: 0,
          display: 'flex',
          justifyContent: 'space-between',
          pointerEvents: 'auto',
          opacity: revealOpacity,
        }}
      >
        <div
          style={{
            width: LEFT_WIDTH,
            flexShrink: 0,
            pointerEvents: showLeft ? 'auto' : 'none',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
          }}
        >
          {leftActions}
        </div>
        <div
          style={{
            width: RIGHT_WIDTH,
            flexShrink: 0,
            pointerEvents: showRight ? 'auto' : 'none',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
          }}
        >
          {rightActions}
        </div>
      </div>

      {/* Blur overlay: between actions and content, fades in with swipe */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 0.5,
          pointerEvents: 'none',
          opacity: blurOpacity,
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />

      {/* Content layer: full width, opaque, translates and scales */}
      <motion.div
        role="button"
        tabIndex={0}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minWidth: '100%',
          minHeight: 68,
          backgroundColor: colors.card,
          transformOrigin: 'left center',
          WebkitTapHighlightColor: 'transparent',
          pointerEvents: Math.abs(translateX) >= LEFT_THRESHOLD || Math.abs(translateX) >= RIGHT_THRESHOLD ? 'none' : 'auto',
          willChange: isDragging ? 'transform' : undefined,
          boxSizing: 'border-box',
        }}
        animate={{ x: translateX, scale }}
        transition={isDragging ? { type: 'tween', duration: 0 } : SPRING}
        onClick={handleContentClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleContentClick(e);
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export { LEFT_WIDTH, RIGHT_WIDTH };
