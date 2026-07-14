import React from 'react';
import { Drawer } from 'vaul';
import { colors, spacing } from '@/ui/tokens';

/**
 * Standard bottom sheet — drag-to-dismiss, backdrop tap, and Escape, which is
 * what users expect from a native sheet.
 *
 * Use this instead of hand-rolling a `fixed inset-0 ... items-end` overlay: the
 * hand-rolled ones don't drag, and several could only be closed by an explicit
 * button. Built on vaul (same primitive as the exercise picker).
 *
 * Note: pass a stable reference for any array/object prop on vaul (an inline
 * `snapPoints={[0.85]}` previously caused an infinite render loop).
 *
 * @param {boolean} open
 * @param {() => void} onClose Called when dragged down, backdrop tapped, or Esc.
 * @param {string} [title] Rendered as the sheet heading; also used for a11y.
 * @param {string} [maxHeight] CSS max-height for the sheet (default 88vh).
 * @param {boolean} [padded] Apply standard horizontal padding to the body.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '88vh',
  padded = true,
}) {
  return (
    <Drawer.Root
      open={!!open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(2,6,23,0.55)',
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column',
            maxHeight,
            background: colors.bg,
            borderTop: `1px solid ${colors.border}`,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            outline: 'none',
          }}
        >
          {/* Grab handle: the affordance that says "drag me down to close". */}
          <div
            style={{
              flexShrink: 0,
              padding: `${spacing[10]}px 0 ${spacing[6]}px`,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{ width: 40, height: 4, borderRadius: 999, background: colors.border }}
              aria-hidden
            />
          </div>

          {/* vaul requires a Title for accessibility; keep it in the tree even
              when the caller renders its own heading. */}
          {title ? (
            <Drawer.Title
              style={{
                flexShrink: 0,
                margin: 0,
                padding: `0 ${spacing[16]}px ${spacing[10]}px`,
                fontSize: 16,
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {title}
            </Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Sheet</Drawer.Title>
          )}

          <div
            style={{
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingLeft: padded ? spacing[16] : 0,
              paddingRight: padded ? spacing[16] : 0,
              paddingBottom: `calc(${spacing[16]}px + env(safe-area-inset-bottom, 0px))`,
            }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
