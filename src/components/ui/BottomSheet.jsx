import React, { useEffect } from 'react';
import { Drawer } from 'vaul';
import { colors, spacing } from '@/ui/tokens';
import { usePresentationMode } from '@/lib/presentationMode';

/**
 * Standard sheet — the one place that owns "how a sheet behaves".
 *
 * - Mobile / native: bottom sheet with drag-to-dismiss (vaul), backdrop tap, Esc.
 *   Hand-rolled `fixed inset-0 ... items-end` overlays never dragged, and several
 *   could only be closed via an explicit button.
 * - Wide web: centred dialog, preserving the `sm:items-center` treatment the
 *   hand-rolled sheets had (a bottom drawer on a desktop monitor reads wrong).
 *
 * Note: vaul is sensitive to unstable props — pass stable references for any
 * array/object prop (an inline `snapPoints={[0.85]}` once caused an infinite
 * render loop in the exercise picker).
 *
 * @param {boolean} open
 * @param {() => void} onClose Called on drag-down, backdrop tap, or Escape.
 * @param {string} [title] Sheet heading; also used for accessibility.
 * @param {string} [maxHeight] Sheet max height on mobile (default 88vh).
 * @param {number} [maxWidth] Dialog max width on wide web (default 560).
 * @param {boolean} [padded] Standard horizontal padding on the body.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '88vh',
  maxWidth = 560,
  padded = true,
}) {
  const { isWideWeb } = usePresentationMode();

  if (isWideWeb) {
    return (
      <CentredDialog open={open} onClose={onClose} title={title} maxWidth={maxWidth} padded={padded}>
        {children}
      </CentredDialog>
    );
  }

  return (
    <Drawer.Root
      open={!!open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2,6,23,0.55)' }} />
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
            <div style={{ width: 40, height: 4, borderRadius: 999, background: colors.border }} aria-hidden />
          </div>

          {/* vaul requires a Title for accessibility. */}
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

function CentredDialog({ open, onClose, title, children, maxWidth, padded }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      onClick={() => onClose?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {title ? (
          <h2
            style={{
              flexShrink: 0,
              margin: 0,
              padding: `${spacing[16]}px ${spacing[16]}px ${spacing[10]}px`,
              fontSize: 16,
              fontWeight: 700,
              color: colors.text,
            }}
          >
            {title}
          </h2>
        ) : null}
        <div
          style={{
            minHeight: 0,
            overflowY: 'auto',
            paddingLeft: padded ? spacing[16] : 0,
            paddingRight: padded ? spacing[16] : 0,
            paddingTop: title ? 0 : spacing[16],
            paddingBottom: spacing[16],
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
