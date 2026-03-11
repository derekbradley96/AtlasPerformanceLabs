import React, { useEffect } from 'react';
import { Copy, Reply, Trash2, X } from 'lucide-react';
import { colors } from '@/ui/tokens';

const BORDER = colors.border;
const TEXT = colors.text;
const MUTED = colors.muted;
const DANGER = colors.danger ?? '#EF4444';

/**
 * Premium bottom sheet for message actions: Copy, Reply, Delete (for me), Delete for everyone (conditional), Cancel.
 * Prevents iOS selection/callout; use with long-press on bubble.
 */
export default function MessageActionSheet({
  message,
  timestamp,
  onCopy,
  onReply,
  onDelete,
  onDeleteForEveryone,
  showDelete,
  showDeleteForEveryone,
  onCancel,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleCopy = () => {
    onCopy?.();
    onCancel?.();
  };

  const handleReply = () => {
    onReply?.();
    onCancel?.();
  };

  const handleDelete = () => {
    onDelete?.();
    onCancel?.();
  };

  const handleDeleteForEveryone = () => {
    onDeleteForEveryone?.();
    onCancel?.();
  };

  return (
    <>
      <div
        role="presentation"
        aria-hidden
        className="fixed inset-0 z-[100]"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-action-sheet-title"
        className="fixed left-0 right-0 z-[101] rounded-t-[24px] overflow-hidden"
        style={{
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: colors.surface1,
          borderTop: `1px solid ${BORDER}`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
        }}
      >
        {timestamp && (
          <div
            id="message-action-sheet-title"
            className="py-3 px-4 border-b text-center"
            style={{ borderColor: BORDER, color: MUTED, fontSize: 13 }}
          >
            {timestamp}
          </div>
        )}
        <div className="py-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 py-3.5 px-4 text-left active:bg-white/5 transition-colors"
            style={{ color: TEXT, fontSize: 16 }}
          >
            <Copy size={20} style={{ color: MUTED, flexShrink: 0 }} />
            Copy
          </button>
          <button
            type="button"
            onClick={handleReply}
            className="w-full flex items-center gap-3 py-3.5 px-4 text-left active:bg-white/5 transition-colors"
            style={{ color: TEXT, fontSize: 16 }}
          >
            <Reply size={20} style={{ color: MUTED, flexShrink: 0 }} />
            Reply
          </button>
          {showDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full flex items-center gap-3 py-3.5 px-4 text-left active:bg-white/5 transition-colors"
              style={{ color: DANGER, fontSize: 16 }}
            >
              <Trash2 size={20} style={{ flexShrink: 0 }} />
              Delete for me
            </button>
          )}
          {showDeleteForEveryone && (
            <div>
              <button
                type="button"
                onClick={handleDeleteForEveryone}
                className="w-full flex items-center gap-3 py-3.5 px-4 text-left active:bg-white/5 transition-colors"
                style={{ color: DANGER, fontSize: 16 }}
              >
                <Trash2 size={20} style={{ flexShrink: 0 }} />
                Delete for everyone
              </button>
              <p className="px-4 pb-1 text-[12px]" style={{ color: MUTED }}>
                Available until read
              </p>
            </div>
          )}
        </div>
        <div className="border-t py-1" style={{ borderColor: BORDER }}>
          <button
            type="button"
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 font-semibold active:bg-white/5 transition-colors"
            style={{ color: MUTED, fontSize: 16 }}
          >
            <X size={18} />
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
