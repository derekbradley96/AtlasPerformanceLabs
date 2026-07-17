import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { impactMedium, impactLight } from '@/lib/haptics';

/**
 * Press-and-hold to reveal a row's actions, the way Instagram/iMessage do it:
 * the row lifts above a dimmed backdrop and a menu appears next to it.
 *
 * This replaces swipe-to-reveal on list rows. Swipe fought the list's own
 * vertical scroll — every gesture had to be classified as "scroll" or "reveal"
 * from the first few pixels, and getting that wrong either moved the row while
 * you scrolled or ate the scroll. A hold has no such ambiguity: any movement
 * before the timer fires is a scroll, so the two gestures can't be confused.
 *
 * @param {{key:string,label:string,icon?:React.ComponentType<any>,destructive?:boolean,onSelect:()=>void}[]} items
 * @param {() => void} [onPress] Fired on a normal tap (not after a hold).
 * @param {boolean} [disabled] Renders children with no hold behaviour.
 * @param {number} [radius] Corner radius of the lifted row.
 * @param {string} [liftBackground] Background painted behind the lifted row.
 */
export default function HoldMenu({
  items = [],
  onPress,
  disabled = false,
  radius = 16,
  liftBackground = '#151B2B',
  label,
  children,
}) {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  // A hold fired, so the click that follows the same gesture must not open the row.
  const heldRef = useRef(false);
  const [rect, setRect] = useState(null);

  const open = rect !== null;
  const active = !disabled && items.length > 0;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    heldRef.current = true;
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    void impactMedium();
  }, []);

  const close = useCallback(() => {
    setRect(null);
    heldRef.current = false;
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (!active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    heldRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timerRef.current = setTimeout(openMenu, 350);
  }, [active, clearTimer, openMenu]);

  // Any real movement means the user is scrolling the list, not holding the row.
  const handlePointerMove = useCallback((e) => {
    if (!timerRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > 10) clearTimer();
  }, [clearTimer]);

  // Capture phase: children may have their own onClick (a Row's onPress, say),
  // and after a hold none of them should fire.
  const handleClickCapture = useCallback((e) => {
    if (heldRef.current || open) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onPress?.();
  }, [open, onPress]);

  // Right-click is the desktop equivalent of a hold.
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!active || open) return;
    openMenu();
  }, [active, open, openMenu]);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const buttons = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? []);
      if (!buttons.length) return;
      const i = buttons.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown'
        ? (i + 1) % buttons.length
        : (i <= 0 ? buttons.length - 1 : i - 1);
      buttons[next]?.focus();
    };
    // A scroll or rotate would leave the lifted row detached from its menu.
    const onReflow = () => close();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [open]);

  const select = useCallback((item) => {
    void impactLight();
    close();
    item.onSelect?.();
  }, [close]);

  let overlay = null;
  if (open && typeof document !== 'undefined') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuH = items.length * 50 + 12;
    const below = rect.top + rect.height + 12;
    // Prefer under the row; flip above when there isn't room.
    const placeBelow = below + menuH <= vh - 12;
    const top = placeBelow ? below : Math.max(12, rect.top - 12 - menuH);
    const left = Math.min(Math.max(rect.left, 12), Math.max(12, vw - 240 - 12));

    overlay = createPortal(
      <div className="fixed inset-0" style={{ zIndex: 200 }} role="presentation">
        <div
          className="absolute inset-0 atlas-hold-backdrop"
          onClick={close}
          /* Without this the list underneath scrolls while the menu is open. */
          onTouchMove={(e) => e.preventDefault()}
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', touchAction: 'none' }}
        />
        <div
          className="absolute atlas-hold-lift"
          aria-hidden
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            borderRadius: radius,
            background: liftBackground,
            overflow: 'hidden',
            pointerEvents: 'none',
            boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
          }}
        >
          {children}
        </div>
        <div
          ref={menuRef}
          role="menu"
          aria-label={label ? `Actions for ${label}` : 'Actions'}
          className="absolute atlas-hold-menu"
          style={{
            top,
            left,
            width: 240,
            // No padding + overflow hidden so the item separators run edge to
            // edge and the end items are clipped by the panel's own radius.
            overflow: 'hidden',
            borderRadius: 14,
            background: 'rgba(30,32,38,0.92)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 16px 44px rgba(0,0,0,0.55)',
            transformOrigin: placeBelow ? 'top left' : 'bottom left',
          }}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            const tint = item.destructive ? '#FF453A' : '#FFFFFF';
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => select(item)}
                className="w-full flex items-center gap-3 atlas-hold-menu-item"
                style={{
                  height: 50,
                  padding: '0 16px',
                  background: 'transparent',
                  border: 'none',
                  color: tint,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {Icon ? <Icon size={19} style={{ flexShrink: 0 }} /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <>
      <div
        ref={wrapRef}
        onPointerDown={active ? handlePointerDown : undefined}
        onPointerMove={active ? handlePointerMove : undefined}
        onPointerUp={active ? clearTimer : undefined}
        onPointerCancel={active ? clearTimer : undefined}
        onClickCapture={handleClickCapture}
        onContextMenu={active ? handleContextMenu : undefined}
        style={{
          // Stops iOS showing its own selection/callout bubble on a long press.
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          // Vertical scrolling stays the browser's job; we never claim the gesture.
          touchAction: 'pan-y',
          opacity: open ? 0 : 1,
        }}
      >
        {children}
      </div>
      {overlay}
    </>
  );
}
