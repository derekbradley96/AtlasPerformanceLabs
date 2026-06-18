import React, { useEffect, useRef } from 'react';
import { Copy, Pencil, Reply, Trash2, X } from 'lucide-react';
import { colors } from '@/ui/tokens';

const BORDER = colors.border;
const TEXT = colors.text;
const MUTED = colors.muted;
const DANGER = colors.danger ?? '#EF4444';

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 px-4 text-left active:bg-white/5 transition-colors"
      style={{ color: danger ? DANGER : TEXT, fontSize: 16 }}
    >
      <Icon size={20} style={{ color: danger ? DANGER : MUTED, flexShrink: 0 }} />
      {label}
    </button>
  );
}

/**
 * Message actions: Reply, Copy, Edit/Delete (own + unread). App: bottom sheet. Web desktop: anchored menu.
 */
export default function MessageActionSheet({
  message,
  timestamp,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  showCopy = true,
  showReply = true,
  showEdit = false,
  showDelete = false,
  isDesktopWeb = false,
  anchor = null,
  onCancel,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  useEffect(() => {
    if (!isDesktopWeb || !anchor) return undefined;
    const handlePointer = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      onCancel?.();
    };
    window.addEventListener('pointerdown', handlePointer, true);
    return () => window.removeEventListener('pointerdown', handlePointer, true);
  }, [isDesktopWeb, anchor, onCancel]);

  const actions = (
    <div className="py-1">
      {showReply && <ActionButton icon={Reply} label="Reply" onClick={() => { onReply?.(); onCancel?.(); }} />}
      {showCopy && <ActionButton icon={Copy} label="Copy" onClick={() => { onCopy?.(); onCancel?.(); }} />}
      {showEdit && <ActionButton icon={Pencil} label="Edit" onClick={() => { onEdit?.(); onCancel?.(); }} />}
      {showDelete && (
        <>
          <ActionButton icon={Trash2} label="Delete" danger onClick={() => { onDelete?.(); onCancel?.(); }} />
          <p className="px-4 pb-2 text-[12px]" style={{ color: MUTED }}>
            Only available before the other person reads it
          </p>
        </>
      )}
    </div>
  );

  if (isDesktopWeb && anchor) {
    const menuWidth = 220;
    const left = Math.min(Math.max(12, anchor.x), window.innerWidth - menuWidth - 12);
    const top = Math.min(Math.max(12, anchor.y), window.innerHeight - 280);
    return (
      <>
        <div role="presentation" className="fixed inset-0 z-[100]" style={{ background: 'transparent' }} onClick={onCancel} />
        <div
          ref={menuRef}
          role="menu"
          aria-label="Message actions"
          className="fixed z-[101] rounded-xl overflow-hidden shadow-lg border"
          style={{
            left,
            top,
            width: menuWidth,
            background: colors.surface1,
            borderColor: BORDER,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          }}
        >
          {timestamp ? (
            <div className="py-2 px-3 border-b text-[12px]" style={{ borderColor: BORDER, color: MUTED }}>
              {timestamp}
            </div>
          ) : null}
          {actions}
        </div>
      </>
    );
  }

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
        className="fixed left-0 right-0 z-[101] rounded-t-[24px] overflow-hidden"
        style={{
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: colors.surface1,
          borderTop: `1px solid ${BORDER}`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
        }}
      >
        {timestamp ? (
          <div className="py-3 px-4 border-b text-center text-[13px]" style={{ borderColor: BORDER, color: MUTED }}>
            {timestamp}
          </div>
        ) : null}
        {actions}
        <div className="border-t py-1" style={{ borderColor: BORDER }}>
          <button
            type="button"
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 font-semibold active:bg-white/5"
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
