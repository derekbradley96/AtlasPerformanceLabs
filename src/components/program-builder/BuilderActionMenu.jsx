/**
 * BuilderActionMenu — compact "⋯" overflow menu for secondary builder actions.
 *
 * Keeps the build screen uncluttered: week/day tools (copy week, duplicate day,
 * coach copy-from-block) live one tap away instead of as always-visible buttons.
 * Closes on outside click and Escape. Items with `hidden: true` are dropped so
 * callers can pass role-conditional actions inline.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { colors, spacing, radii, shell } from '@/ui/tokens';

export default function BuilderActionMenu({
  items,
  ariaLabel = 'More actions',
  align = 'right',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const rootRef = useRef(null);

  const visibleItems = (items || []).filter((it) => it && !it.hidden);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!visibleItems.length) return null;

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.button,
          border: `1px solid ${open ? colors.primary : shell.cardBorder}`,
          background: open ? colors.primarySubtle : colors.surface1,
          color: open ? colors.primary : colors.text,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <MoreHorizontal size={18} />
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align === 'left' ? 'left' : 'right']: 0,
            zIndex: 60,
            minWidth: 210,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          }}
        >
          {visibleItems.map((item, idx) => {
            const Icon = item.icon;
            const isHovered = hovered === idx && !item.disabled;
            return (
              <button
                key={item.key || item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered((cur) => (cur === idx ? null : cur))}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 42,
                  padding: `0 ${spacing[10]}px`,
                  borderRadius: 8,
                  border: 'none',
                  background: isHovered ? colors.surface1 : 'transparent',
                  color: item.danger ? colors.danger : colors.text,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.45 : 1,
                  transition: 'background 0.12s',
                }}
              >
                {Icon ? <Icon size={16} /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
