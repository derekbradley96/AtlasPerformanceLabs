/**
 * Full-screen modal for Capacitor/iOS/Android. Not a bottom sheet.
 * Header (title + right action), scrollable body, optional sticky footer with safe area.
 */
import React from 'react';
import { X } from 'lucide-react';
import { colors, spacing } from '@/ui/tokens';

export default function FullScreenModal({
  open,
  onClose,
  title,
  rightAction = 'cancel',
  rightLabel = 'Cancel',
  children,
  footer,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-screen-modal-title"
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{
          minHeight: 52,
          borderColor: colors.border,
          background: colors.bg,
        }}
      >
        <h2 id="full-screen-modal-title" className="text-lg font-semibold truncate" style={{ color: colors.text }}>
          {title}
        </h2>
        {rightAction === 'cancel' ? (
          <button
            type="button"
            onClick={() => onClose?.()}
            className="text-sm font-medium flex-shrink-0 py-2 px-1"
            style={{ color: colors.accent }}
          >
            {rightLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-2 rounded-lg active:opacity-80 flex-shrink-0"
            style={{ color: colors.muted, background: 'transparent', border: 'none' }}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        )}
      </header>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: spacing[16], paddingBottom: footer ? spacing[12] : spacing[24] }}>
          {children}
        </div>
      </div>

      {/* Sticky footer (optional) with safe area */}
      {footer && (
        <div
          className="flex-shrink-0 border-t px-4 pt-4 pb-safe"
          style={{
            borderColor: colors.border,
            background: colors.bg,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
