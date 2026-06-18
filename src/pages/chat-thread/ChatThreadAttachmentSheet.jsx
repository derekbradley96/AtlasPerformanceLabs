import React, { useEffect } from 'react';
import { colors } from '@/ui/tokens';
import { BG, BORDER, MUTED } from '@/pages/chat-thread/chatThreadConstants';
import { lightHaptic } from '@/pages/chat-thread/chatThreadHaptics';

/** Photo / camera / video / cancel — attachment entry for composer. */
export default function ChatThreadAttachmentSheet({ onPhoto, onCamera, onVideo, onCancel }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);
  return (
    <>
      <div role="presentation" className="fixed inset-0 z-40" style={{ background: colors.overlay }} onClick={onCancel} />
      <div
        className="fixed left-4 right-4 z-50 rounded-2xl overflow-hidden border"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', background: BG, borderColor: BORDER }}
      >
        <div className="py-1">
          <button
            type="button"
            onClick={() => {
              lightHaptic();
              onPhoto();
              onCancel();
            }}
            className="w-full py-3 text-[15px] font-medium active:bg-white/5"
            style={{ color: colors.text }}
          >
            Photo
          </button>
          <button
            type="button"
            onClick={() => {
              lightHaptic();
              onCamera();
              onCancel();
            }}
            className="w-full py-3 text-[15px] font-medium active:bg-white/5"
            style={{ color: colors.text }}
          >
            Camera
          </button>
          <button
            type="button"
            onClick={() => {
              lightHaptic();
              onVideo();
              onCancel();
            }}
            className="w-full py-3 text-[15px] font-medium active:bg-white/5"
            style={{ color: colors.text }}
          >
            Video
          </button>
        </div>
        <div className="border-t" style={{ borderColor: BORDER }}>
          <button type="button" onClick={onCancel} className="w-full py-3 text-[15px] font-semibold active:bg-white/5" style={{ color: MUTED }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
