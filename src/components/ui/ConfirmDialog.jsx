/**
 * Confirm modal for destructive or important actions.
 */
import React, { useEffect } from 'react';
import { colors, spacing } from '@/ui/tokens';
import Button from '@/ui/Button';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: colors.overlay,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => onCancel?.()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: colors.bg,
          border: '1px solid ' + colors.border,
          padding: spacing[24],
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold" style={{ color: colors.text, marginBottom: spacing[8] }}>
          {title}
        </h2>
        <p className="text-[15px]" style={{ color: colors.muted, marginBottom: spacing[20] }}>
          {message}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            style={{
              flex: 1,
              ...(isDanger && { background: colors.danger }),
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
