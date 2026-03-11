import React, { useEffect } from 'react';

const BG = '#0B1220';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#E5E7EB';
const MUTED = 'rgba(229,231,235,0.65)';
const DESTRUCTIVE = '#FEE2E2';

/**
 * iOS-style action sheet for a message: timestamp (optional), Copy, Reply, Delete (optional), Cancel.
 * Dismiss on overlay click or Escape.
 */
export default function MessageActionSheet({
  onCopy,
  onReply,
  onDelete,
  onCancel,
  showDelete,
  timestamp,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onCancel}
        onTouchEnd={(e) => {
          e.preventDefault();
          onCancel();
        }}
      />
      <div
        className="fixed left-4 right-4 z-50 rounded-2xl overflow-hidden border"
        style={{
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          background: BG,
          borderColor: BORDER,
        }}
      >
        {timestamp && (
          <div
            className="py-2.5 px-4 border-b text-center"
            style={{ borderColor: BORDER, color: MUTED, fontSize: 13 }}
          >
            {timestamp}
          </div>
        )}
        <div className="py-1">
          <button
            type="button"
            onClick={() => {
              onCopy();
              onCancel();
            }}
            className="w-full py-3 text-[15px] font-medium active:bg-white/5"
            style={{ color: TEXT }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => {
              onReply();
              onCancel();
            }}
            className="w-full py-3 text-[15px] font-medium active:bg-white/5"
            style={{ color: TEXT }}
          >
            Reply
          </button>
          {showDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onCancel();
              }}
              className="w-full py-3 text-[15px] font-medium active:bg-white/5"
              style={{ color: DESTRUCTIVE }}
            >
              Delete
            </button>
          )}
        </div>
        <div className="border-t" style={{ borderColor: BORDER }}>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 text-[15px] font-semibold active:bg-white/5"
            style={{ color: MUTED }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
